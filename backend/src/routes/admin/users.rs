use bcrypt::{DEFAULT_COST, hash};
use rocket::State;
use rocket::http::{CookieJar, Status};
use rocket::serde::json::Json;
use rocket_db_pools::Connection;
use rocket_db_pools::diesel::prelude::*;
use std::net::SocketAddr;
use tracing::{error, info};

use crate::db::MessagesDB;
use crate::error::{AppError, AppResult};
use crate::models::{
    AdminCreateUserRequest, AdminSetupRequest, AdminUpdateUserRequest, AdminUser, AdminUserDto,
    NewAdminUser,
};
use crate::routes::admin::auth::{
    get_authenticated_user_id, has_admin_users, is_admin_authenticated, start_admin_session,
};
use crate::schema::admin_users;

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
