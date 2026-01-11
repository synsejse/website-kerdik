use bcrypt::verify;
use rocket::State;
use rocket::http::{Cookie, CookieJar, SameSite, Status};
use rocket::serde::json::Json;
use rocket_db_pools::Connection;
use rocket_db_pools::diesel::prelude::*;
use std::net::SocketAddr;
use uuid::Uuid;

use crate::db::MessagesDB;
use crate::models::{AdminLoginRequest, AdminSession, AppState, Message, NewAdminSession};
use crate::schema::{admin_sessions, messages};

// Helper function to check if admin is authenticated
async fn is_admin_authenticated(
    cookies: &CookieJar<'_>,
    db: &mut Connection<MessagesDB>,
    remote_addr: Option<SocketAddr>,
) -> bool {
    if let Some(cookie) = cookies.get("admin_auth") {
        let token = cookie.value();
        let session: Option<AdminSession> = admin_sessions::table
            .find(token)
            .select(AdminSession::as_select())
            .first(db)
            .await
            .optional()
            .unwrap_or(None);

        if let Some(session) = session {
            // Check if session has expired
            if let Some(expires_at) = session.expires_at {
                if expires_at < chrono::Utc::now().naive_utc() {
                    return false;
                }
            }

            // Check if IP address matches if both are present
            if let (Some(saved_ip), Some(current_ip)) = (session.ip_address, remote_addr) {
                return saved_ip == current_ip.ip().to_string();
            }
            return true;
        }
    }
    false
}

#[post("/admin/login", format = "json", data = "<login>")]
pub async fn admin_login(
    mut db: Connection<MessagesDB>,
    state: &State<AppState>,
    cookies: &CookieJar<'_>,
    login: Json<AdminLoginRequest>,
    remote_addr: Option<SocketAddr>,
) -> Result<Status, Status> {
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
                eprintln!("Error creating admin session: {}", e);
                Status::InternalServerError
            })?;

        let mut cookie = Cookie::new("admin_auth", token);
        cookie.set_http_only(true);
        cookie.set_same_site(SameSite::Lax);
        cookie.set_path("/");
        cookie.set_max_age(rocket::time::Duration::hours(24));
        cookies.add(cookie);
        Ok(Status::Ok)
    } else {
        // Clear any existing invalid cookie
        cookies.remove(Cookie::from("admin_auth"));
        Err(Status::Unauthorized)
    }
}

#[post("/admin/logout")]
pub async fn admin_logout(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
) -> Result<Status, Status> {
    if let Some(cookie) = cookies.get("admin_auth") {
        let token = cookie.value();
        diesel::delete(admin_sessions::table.find(token))
            .execute(&mut db)
            .await
            .ok();
        cookies.remove(Cookie::from("admin_auth"));
    }
    Ok(Status::Ok)
}

#[get("/admin/check")]
pub async fn admin_check(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
) -> Result<Json<bool>, Status> {
    let authenticated = is_admin_authenticated(cookies, &mut db, remote_addr).await;
    Ok(Json(authenticated))
}

#[get("/admin/api/messages")]
pub async fn get_messages(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
) -> Result<Json<Vec<Message>>, Status> {
    if !is_admin_authenticated(cookies, &mut db, remote_addr).await {
        return Err(Status::Unauthorized);
    }

    let results = messages::table
        .order(messages::created_at.desc())
        .select(Message::as_select())
        .load(&mut db)
        .await
        .map_err(|e| {
            eprintln!("Error loading messages: {}", e);
            Status::InternalServerError
        })?;

    Ok(Json(results))
}

#[delete("/admin/api/messages/<id>")]
pub async fn delete_message(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    id: i64,
) -> Result<Status, Status> {
    if !is_admin_authenticated(cookies, &mut db, remote_addr).await {
        return Err(Status::Unauthorized);
    }

    diesel::delete(messages::table.find(id))
        .execute(&mut db)
        .await
        .map_err(|e| {
            eprintln!("Error deleting message: {}", e);
            Status::InternalServerError
        })?;

    Ok(Status::Ok)
}
