// Admin authentication endpoints

use bcrypt::verify;
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
use crate::models::{AdminLoginRequest, AppState, NewAdminSession};
use crate::schema::admin_sessions;

/// Helper function to check if admin is authenticated
pub async fn is_admin_authenticated(
    cookies: &CookieJar<'_>,
    db: &mut Connection<MessagesDB>,
    remote_addr: Option<SocketAddr>,
) -> AppResult<bool> {
    let cookie = match cookies.get("admin_auth") {
        Some(cookie) => cookie,
        None => return Ok(false),
    };

    let token = cookie.value();
    let session = admin_sessions::table
        .find(token)
        .select(crate::models::AdminSession::as_select())
        .first(db)
        .await
        .optional()
        .map_err(|e| {
            error!("Database error checking admin session: {}", e);
            AppError::from(e)
        })?;

    let session = match session {
        Some(s) => s,
        None => return Ok(false),
    };

    // Check if session has expired
    if let Some(expires_at) = session.expires_at
        && expires_at < chrono::Utc::now().naive_utc()
    {
        debug!("Admin session expired");
        return Ok(false);
    }

    // Check if IP address matches
    if let Some(saved_ip) = session.ip_address {
        if let Some(current_ip) = remote_addr {
            if saved_ip != current_ip.ip().to_string() {
                warn!("Admin session IP mismatch");
                return Ok(false);
            }
        } else {
            // Session has an IP but requester has no IP detected
            debug!("Session has IP but request has none");
            return Ok(false);
        }
    }

    debug!("Admin session validated successfully");
    Ok(true)
}

#[post("/admin/login", format = "json", data = "<login>")]
pub async fn admin_login(
    mut db: Connection<MessagesDB>,
    state: &State<AppState>,
    cookies: &CookieJar<'_>,
    login: Json<AdminLoginRequest>,
    remote_addr: Option<SocketAddr>,
) -> AppResult<Status> {
    if state.admin_password_hash.is_empty() {
        error!("Admin login attempted but ADMIN_PASSWORD_HASH is not configured");
        return Err(AppError::Unauthorized);
    }

    if verify(&login.password, &state.admin_password_hash).unwrap_or(false) {
        let token = Uuid::new_v4().to_string();
        let expires_at = chrono::Utc::now().naive_utc() + chrono::Duration::hours(24);

        let new_session = NewAdminSession {
            session_token: token.clone(),
            expires_at: Some(expires_at),
            ip_address: remote_addr.map(|addr| addr.ip().to_string()),
        };

        diesel::insert_into(admin_sessions::table)
            .values(&new_session)
            .execute(&mut db)
            .await
            .map_err(|e| {
                error!("Error creating admin session: {}", e);
                AppError::from(e)
            })?;

        let mut cookie = Cookie::new("admin_auth", token);
        cookie.set_http_only(true);
        cookie.set_same_site(SameSite::Lax);
        cookie.set_path("/");
        cookie.set_max_age(rocket::time::Duration::hours(24));
        cookies.add(cookie);

        info!("Admin login successful from {:?}", remote_addr);
        Ok(Status::Ok)
    } else {
        // Clear any existing invalid cookie
        cookies.remove(Cookie::from("admin_auth"));
        warn!("Failed admin login attempt from {:?}", remote_addr);
        Err(AppError::Unauthorized)
    }
}

#[post("/admin/logout")]
pub async fn admin_logout(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
) -> AppResult<Status> {
    if let Some(cookie) = cookies.get("admin_auth") {
        let token = cookie.value();
        diesel::delete(admin_sessions::table.find(token))
            .execute(&mut db)
            .await
            .map_err(|e| {
                error!("Error deleting admin session: {}", e);
                AppError::from(e)
            })?;
        cookies.remove(Cookie::from("admin_auth"));
        info!("Admin logged out successfully");
    } else {
        debug!("Logout attempted without session cookie");
    }
    Ok(Status::Ok)
}

#[get("/admin/check")]
pub async fn admin_check(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
) -> AppResult<Json<bool>> {
    let authenticated = is_admin_authenticated(cookies, &mut db, remote_addr).await?;
    debug!("Admin check: authenticated={}", authenticated);
    Ok(Json(authenticated))
}
