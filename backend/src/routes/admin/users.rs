use bcrypt::{DEFAULT_COST, hash};
use rocket::State;
use rocket::http::{CookieJar, Status};
use rocket::serde::json::Json;
use rocket_db_pools::Connection;
use rocket_db_pools::diesel::prelude::*;
use std::net::SocketAddr;
use tracing::{error, info};
use uuid::Uuid;

use crate::db::MessagesDB;
use crate::error::{AppError, AppResult};
use crate::models::{
    AdminAcceptInviteRequest, AdminCreateInviteRequest, AdminCreateUserRequest,
    AdminSetupRequest, AdminUpdateUserRequest, AdminUser, AdminUserDto, AdminUserInvite,
    AdminUserInviteDto, NewAdminUser, NewAdminUserInvite,
};
use crate::routes::admin::auth::{
    get_authenticated_user_id, has_admin_users, is_admin_authenticated, start_admin_session,
};
use crate::schema::{admin_user_invites, admin_users};

const INVITE_TTL_HOURS: i64 = 72;

fn to_user_dto(user: AdminUser) -> AdminUserDto {
    AdminUserDto {
        id: user.id,
        username: user.username,
        created_at: user.created_at,
        updated_at: user.updated_at,
    }
}

fn normalize_username(username: &str) -> AppResult<String> {
    let trimmed = username.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidInput("Username is required.".to_string()));
    }
    if trimmed.len() < 3 {
        return Err(AppError::InvalidInput(
            "Username must be at least 3 characters long.".to_string(),
        ));
    }
    Ok(trimmed.to_string())
}

fn validate_password(password: &str) -> AppResult<()> {
    if password.len() < 8 {
        return Err(AppError::InvalidInput(
            "Password must be at least 8 characters long.".to_string(),
        ));
    }
    Ok(())
}

fn to_invite_dto(invite: AdminUserInvite) -> AdminUserInviteDto {
    AdminUserInviteDto {
        id: invite.id,
        username: invite.username,
        token: invite.token.clone(),
        invite_path: format!("/admin/invite?token={}", invite.token),
        expires_at: invite.expires_at,
        created_at: invite.created_at,
    }
}

async fn delete_expired_invites(db: &mut Connection<MessagesDB>) -> AppResult<()> {
    diesel::delete(
        admin_user_invites::table.filter(admin_user_invites::expires_at.lt(chrono::Utc::now().naive_utc())),
    )
    .execute(db)
    .await?;
    Ok(())
}

fn map_user_write_error(error: diesel::result::Error) -> AppError {
    match error {
        diesel::result::Error::DatabaseError(diesel::result::DatabaseErrorKind::UniqueViolation, _) => {
            AppError::InvalidInput("A user with this username already exists.".to_string())
        }
        other => AppError::from(other),
    }
}

#[post("/admin/setup", format = "json", data = "<setup>")]
pub async fn admin_setup(
    mut db: Connection<MessagesDB>,
    redis: &State<redis::Client>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    setup: Json<AdminSetupRequest>,
) -> AppResult<Json<AdminUserDto>> {
    if has_admin_users(&mut db).await? {
        return Err(AppError::InvalidInput(
            "Initial setup has already been completed.".to_string(),
        ));
    }

    let username = normalize_username(&setup.username)?;
    validate_password(&setup.password)?;

    let password_hash = hash(&setup.password, DEFAULT_COST)?;
    let new_user = NewAdminUser {
        username: username.clone(),
        password_hash,
    };

    diesel::insert_into(admin_users::table)
        .values(&new_user)
        .execute(&mut db)
        .await
        .map_err(map_user_write_error)?;

    let created_user: AdminUser = admin_users::table
        .filter(admin_users::username.eq(&username))
        .select(AdminUser::as_select())
        .first(&mut db)
        .await?;

    start_admin_session(redis, cookies, created_user.id, remote_addr).await?;
    info!("Initial admin user '{}' created", created_user.username);

    Ok(Json(to_user_dto(created_user)))
}

#[get("/admin/api/users/invites")]
pub async fn list_admin_invites(
    mut db: Connection<MessagesDB>,
    redis: &State<redis::Client>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
) -> AppResult<Json<Vec<AdminUserInviteDto>>> {
    if !is_admin_authenticated(cookies, &mut db, redis, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    delete_expired_invites(&mut db).await?;

    let invites = admin_user_invites::table
        .order(admin_user_invites::created_at.desc())
        .select(AdminUserInvite::as_select())
        .load::<AdminUserInvite>(&mut db)
        .await?;

    Ok(Json(invites.into_iter().map(to_invite_dto).collect()))
}

#[post("/admin/api/users/invites", format = "json", data = "<request>")]
pub async fn create_admin_invite(
    mut db: Connection<MessagesDB>,
    redis: &State<redis::Client>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    request: Json<AdminCreateInviteRequest>,
) -> AppResult<Json<AdminUserInviteDto>> {
    let current_user_id = get_authenticated_user_id(cookies, &mut db, redis, remote_addr).await?;
    let Some(current_user_id) = current_user_id else {
        return Err(AppError::Unauthorized);
    };

    let username = normalize_username(&request.username)?;
    delete_expired_invites(&mut db).await?;

    let existing_user: Option<i64> = admin_users::table
        .filter(admin_users::username.eq(&username))
        .select(admin_users::id)
        .first(&mut db)
        .await
        .optional()?;
    if existing_user.is_some() {
        return Err(AppError::InvalidInput(
            "A user with this username already exists.".to_string(),
        ));
    }

    let token = Uuid::new_v4().simple().to_string();
    let invite = NewAdminUserInvite {
        username: username.clone(),
        token: token.clone(),
        expires_at: chrono::Utc::now().naive_utc() + chrono::Duration::hours(INVITE_TTL_HOURS),
        created_by: Some(current_user_id),
    };

    diesel::insert_into(admin_user_invites::table)
        .values(&invite)
        .execute(&mut db)
        .await
        .map_err(map_user_write_error)?;

    let created_invite = admin_user_invites::table
        .filter(admin_user_invites::token.eq(&token))
        .select(AdminUserInvite::as_select())
        .first(&mut db)
        .await?;

    Ok(Json(to_invite_dto(created_invite)))
}

#[delete("/admin/api/users/invites/<id>")]
pub async fn delete_admin_invite(
    mut db: Connection<MessagesDB>,
    redis: &State<redis::Client>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    id: i64,
) -> AppResult<Status> {
    if !is_admin_authenticated(cookies, &mut db, redis, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    diesel::delete(admin_user_invites::table.find(id))
        .execute(&mut db)
        .await?;

    Ok(Status::Ok)
}

#[get("/admin/invite/status?<token>")]
pub async fn get_admin_invite_status(
    mut db: Connection<MessagesDB>,
    token: &str,
) -> AppResult<Json<AdminUserInviteDto>> {
    delete_expired_invites(&mut db).await?;

    let invite = admin_user_invites::table
        .filter(admin_user_invites::token.eq(token))
        .select(AdminUserInvite::as_select())
        .first(&mut db)
        .await
        .map_err(|_| AppError::NotFound)?;

    Ok(Json(to_invite_dto(invite)))
}

#[post("/admin/invite/accept", format = "json", data = "<request>")]
pub async fn accept_admin_invite(
    mut db: Connection<MessagesDB>,
    redis: &State<redis::Client>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    request: Json<AdminAcceptInviteRequest>,
) -> AppResult<Json<AdminUserDto>> {
    delete_expired_invites(&mut db).await?;
    validate_password(&request.password)?;

    let invite = admin_user_invites::table
        .filter(admin_user_invites::token.eq(request.token.trim()))
        .select(AdminUserInvite::as_select())
        .first(&mut db)
        .await
        .map_err(|_| AppError::NotFound)?;

    let new_user = NewAdminUser {
        username: invite.username.clone(),
        password_hash: hash(&request.password, DEFAULT_COST)?,
    };

    db.transaction(|conn| {
        Box::pin(async move {
            diesel::insert_into(admin_users::table)
                .values(&new_user)
                .execute(conn)
                .await?;

            diesel::delete(admin_user_invites::table.find(invite.id))
                .execute(conn)
                .await?;

            Ok::<_, diesel::result::Error>(())
        })
    })
    .await
    .map_err(map_user_write_error)?;

    let created_user = admin_users::table
        .filter(admin_users::username.eq(&invite.username))
        .select(AdminUser::as_select())
        .first(&mut db)
        .await?;

    start_admin_session(redis, cookies, created_user.id, remote_addr).await?;
    Ok(Json(to_user_dto(created_user)))
}

#[get("/admin/api/users")]
pub async fn list_admin_users(
    mut db: Connection<MessagesDB>,
    redis: &State<redis::Client>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
) -> AppResult<Json<Vec<AdminUserDto>>> {
    if !is_admin_authenticated(cookies, &mut db, redis, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    let users = admin_users::table
        .order(admin_users::created_at.asc())
        .select(AdminUser::as_select())
        .load::<AdminUser>(&mut db)
        .await?;

    Ok(Json(users.into_iter().map(to_user_dto).collect()))
}

#[post("/admin/api/users", format = "json", data = "<request>")]
pub async fn create_admin_user(
    mut db: Connection<MessagesDB>,
    redis: &State<redis::Client>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    request: Json<AdminCreateUserRequest>,
) -> AppResult<Json<AdminUserDto>> {
    if !is_admin_authenticated(cookies, &mut db, redis, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    let username = normalize_username(&request.username)?;
    validate_password(&request.password)?;

    let new_user = NewAdminUser {
        username: username.clone(),
        password_hash: hash(&request.password, DEFAULT_COST)?,
    };

    diesel::insert_into(admin_users::table)
        .values(&new_user)
        .execute(&mut db)
        .await
        .map_err(map_user_write_error)?;

    let created_user: AdminUser = admin_users::table
        .filter(admin_users::username.eq(&username))
        .select(AdminUser::as_select())
        .first(&mut db)
        .await?;

    Ok(Json(to_user_dto(created_user)))
}

#[put("/admin/api/users/<id>", format = "json", data = "<request>")]
pub async fn update_admin_user(
    mut db: Connection<MessagesDB>,
    redis: &State<redis::Client>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    id: i64,
    request: Json<AdminUpdateUserRequest>,
) -> AppResult<Status> {
    if !is_admin_authenticated(cookies, &mut db, redis, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    let username = normalize_username(&request.username)?;
    let existing: AdminUser = admin_users::table
        .find(id)
        .select(AdminUser::as_select())
        .first(&mut db)
        .await
        .map_err(|_| AppError::NotFound)?;

    match request.password.as_deref().map(str::trim) {
        Some(password) if !password.is_empty() => {
            validate_password(password)?;
            let password_hash = hash(password, DEFAULT_COST)?;
            diesel::update(admin_users::table.find(id))
                .set((
                    admin_users::username.eq(&username),
                    admin_users::password_hash.eq(password_hash),
                ))
                .execute(&mut db)
                .await
                .map_err(map_user_write_error)?;
        }
        _ => {
            diesel::update(admin_users::table.find(id))
                .set(admin_users::username.eq(&username))
                .execute(&mut db)
                .await
                .map_err(map_user_write_error)?;
        }
    }

    info!("Admin user '{}' updated", existing.username);
    Ok(Status::Ok)
}

#[delete("/admin/api/users/<id>")]
pub async fn delete_admin_user(
    mut db: Connection<MessagesDB>,
    redis: &State<redis::Client>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    id: i64,
) -> AppResult<Status> {
    let current_user_id = get_authenticated_user_id(cookies, &mut db, redis, remote_addr).await?;
    let Some(current_user_id) = current_user_id else {
        return Err(AppError::Unauthorized);
    };

    if current_user_id == id {
        return Err(AppError::InvalidInput(
            "You cannot delete the currently signed-in user.".to_string(),
        ));
    }

    let total_users: i64 = admin_users::table.count().get_result(&mut db).await?;
    if total_users <= 1 {
        return Err(AppError::InvalidInput(
            "At least one admin user must remain.".to_string(),
        ));
    }

    diesel::delete(admin_users::table.find(id))
        .execute(&mut db)
        .await
        .map_err(|e| {
            error!("Error deleting admin user {}: {}", id, e);
            AppError::from(e)
        })?;

    Ok(Status::Ok)
}
