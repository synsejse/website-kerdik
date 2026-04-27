// Admin authentication endpoints

use bcrypt::verify;
use redis::AsyncCommands;
use rocket::State;
use rocket::http::{Cookie, CookieJar, SameSite, Status};
use rocket::serde::json::Json;
use rocket_db_pools::Connection;
use rocket_db_pools::diesel::prelude::*;
use std::net::SocketAddr;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::db::MessagesDB;
use crate::error::{AppError, AppResult};
use crate::models::{AdminLoginRequest, AdminStatusResponse, AdminUser};
use crate::schema::admin_users;

const SESSION_COOKIE: &str = "admin_auth";
const SESSION_PREFIX: &str = "admin_session:";
const SESSION_TTL_SECS: u64 = 60 * 60 * 24;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
struct AdminSessionData {
    user_id: i64,
    ip_address: Option<String>,
}

fn session_key(token: &str) -> String {
    format!("{SESSION_PREFIX}{token}")
}

async fn store_session(
    redis: &State<redis::Client>,
    token: &str,
    session: &AdminSessionData,
) -> AppResult<()> {
    let payload = serde_json::to_string(session)?;
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let _: () = conn
        .set_ex(session_key(token), payload, SESSION_TTL_SECS)
        .await?;
    Ok(())
}

async fn delete_session(redis: &State<redis::Client>, token: &str) -> AppResult<()> {
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let _: usize = conn.del(session_key(token)).await?;
    Ok(())
}

pub async fn has_admin_users(db: &mut Connection<MessagesDB>) -> AppResult<bool> {
    let count: i64 = admin_users::table.count().get_result(db).await?;
    Ok(count > 0)
}

pub async fn get_authenticated_user(
    cookies: &CookieJar<'_>,
    db: &mut Connection<MessagesDB>,
    redis: &State<redis::Client>,
    remote_addr: Option<SocketAddr>,
) -> AppResult<Option<AdminUser>> {
    let cookie = match cookies.get(SESSION_COOKIE) {
        Some(cookie) => cookie,
        None => return Ok(None),
    };

    let token = cookie.value();
    let mut conn = redis.get_multiplexed_async_connection().await?;
    let session_payload: Option<String> = conn.get(session_key(token)).await?;

    let session_payload = match session_payload {
        Some(value) => value,
        None => return Ok(None),
    };

    let session: AdminSessionData = serde_json::from_str(&session_payload)?;

    if let Some(saved_ip) = session.ip_address {
        if let Some(current_ip) = remote_addr {
            if saved_ip != current_ip.ip().to_string() {
                warn!("Admin session IP mismatch");
                return Ok(None);
            }
        } else {
            debug!("Session has IP but request has none");
            return Ok(None);
        }
    }

    let user = admin_users::table
        .find(session.user_id)
        .select(AdminUser::as_select())
        .first(db)
        .await
        .optional()
        .map_err(|e| {
            error!("Database error checking authenticated admin user: {}", e);
            AppError::from(e)
        })?;

    Ok(user)
}

pub async fn get_authenticated_user_id(
    cookies: &CookieJar<'_>,
    db: &mut Connection<MessagesDB>,
    redis: &State<redis::Client>,
    remote_addr: Option<SocketAddr>,
) -> AppResult<Option<i64>> {
    Ok(get_authenticated_user(cookies, db, redis, remote_addr)
        .await?
        .map(|user| user.id))
}

/// Helper function to check if admin is authenticated
pub async fn is_admin_authenticated(
    cookies: &CookieJar<'_>,
    db: &mut Connection<MessagesDB>,
    redis: &State<redis::Client>,
    remote_addr: Option<SocketAddr>,
) -> AppResult<bool> {
    Ok(get_authenticated_user(cookies, db, redis, remote_addr)
        .await?
        .is_some())
}

pub async fn start_admin_session(
    redis: &State<redis::Client>,
    cookies: &CookieJar<'_>,
    user_id: i64,
    remote_addr: Option<SocketAddr>,
) -> AppResult<()> {
    let token = Uuid::new_v4().to_string();
    let session = AdminSessionData {
        user_id,
        ip_address: remote_addr.map(|addr| addr.ip().to_string()),
    };

    store_session(redis, &token, &session).await?;

    let mut cookie = Cookie::new(SESSION_COOKIE, token);
    cookie.set_http_only(true);
    cookie.set_same_site(SameSite::Lax);
    cookie.set_path("/");
    cookie.set_max_age(rocket::time::Duration::hours(24));
    cookies.add(cookie);

    Ok(())
}

#[post("/admin/login", format = "json", data = "<login>")]
pub async fn admin_login(
    mut db: Connection<MessagesDB>,
    redis: &State<redis::Client>,
    cookies: &CookieJar<'_>,
    login: Json<AdminLoginRequest>,
    remote_addr: Option<SocketAddr>,
) -> AppResult<Status> {
    if !has_admin_users(&mut db).await? {
        return Err(AppError::InvalidInput(
            "Initial user setup is required before signing in.".to_string(),
        ));
    }

    let username = login.username.trim();
    if username.is_empty() {
        return Err(AppError::InvalidInput("Username is required.".to_string()));
    }

    let user = admin_users::table
        .filter(admin_users::username.eq(username))
        .select(AdminUser::as_select())
        .first(&mut db)
        .await
        .optional()
        .map_err(|e| {
            error!("Error loading admin user '{}': {}", username, e);
            AppError::from(e)
        })?;

    let Some(user) = user else {
        cookies.remove(Cookie::from(SESSION_COOKIE));
        warn!("Failed admin login attempt for unknown user '{}'", username);
        return Err(AppError::Unauthorized);
    };

    if verify(&login.password, &user.password_hash).unwrap_or(false) {
        start_admin_session(redis, cookies, user.id, remote_addr).await?;

        info!(
            "Admin login successful for '{}' from {:?}",
            user.username, remote_addr
        );
        Ok(Status::Ok)
    } else {
        cookies.remove(Cookie::from(SESSION_COOKIE));
        warn!(
            "Failed admin login attempt for '{}' from {:?}",
            user.username, remote_addr
        );
        Err(AppError::Unauthorized)
    }
}

#[post("/admin/logout")]
pub async fn admin_logout(
    redis: &State<redis::Client>,
    cookies: &CookieJar<'_>,
) -> AppResult<Status> {
    if let Some(cookie) = cookies.get(SESSION_COOKIE) {
        delete_session(redis, cookie.value()).await?;
        cookies.remove(Cookie::from(SESSION_COOKIE));
        info!("Admin logged out successfully");
    } else {
        debug!("Logout attempted without session cookie");
    }
    Ok(Status::Ok)
}

#[get("/admin/status")]
pub async fn admin_status(
    mut db: Connection<MessagesDB>,
    redis: &State<redis::Client>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
) -> AppResult<Json<AdminStatusResponse>> {
    let setup_required = !has_admin_users(&mut db).await?;

    if setup_required {
        return Ok(Json(AdminStatusResponse {
            authenticated: false,
            setup_required: true,
            current_user_id: None,
            current_username: None,
        }));
    }

    let user = get_authenticated_user(cookies, &mut db, redis, remote_addr).await?;
    Ok(Json(AdminStatusResponse {
        authenticated: user.is_some(),
        setup_required: false,
        current_user_id: user.as_ref().map(|entry| entry.id),
        current_username: user.map(|entry| entry.username),
    }))
}
