// Archived message management endpoints

use rocket::http::{CookieJar, Status};
use rocket::serde::json::Json;
use rocket::serde::{Deserialize, Serialize};
use rocket_db_pools::Connection;
use rocket_db_pools::diesel::prelude::*;
use std::net::SocketAddr;
use tracing::{error, info};

use crate::db::MessagesDB;
use crate::error::{AppError, AppResult};
use crate::models::ArchivedMessage;
use crate::routes::admin::auth::is_admin_authenticated;
use crate::schema::messages_archive;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct PaginatedArchivedMessages {
    pub data: Vec<ArchivedMessage>,
    pub total: i64,
    pub page: i64,
    pub limit: i64,
}

#[get("/admin/api/archived/messages?<page>&<limit>")]
pub async fn get_archived_messages(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    page: Option<i64>,
    limit: Option<i64>,
) -> AppResult<Json<PaginatedArchivedMessages>> {
    if !is_admin_authenticated(cookies, &mut db, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    let page = page.unwrap_or(1);
    let limit = limit.unwrap_or(10);
    let offset = (page - 1) * limit;

    let total_count: i64 = messages_archive::table
        .count()
        .get_result(&mut db)
        .await
        .map_err(|e| {
            error!("Error counting archived messages: {}", e);
            AppError::from(e)
        })?;

    let results = messages_archive::table
        .order(messages_archive::archived_at.desc())
        .limit(limit)
        .offset(offset)
        .select(ArchivedMessage::as_select())
        .load(&mut db)
        .await
        .map_err(|e| {
            error!("Error loading archived messages: {}", e);
            AppError::from(e)
        })?;

    info!(
        "Retrieved {} archived messages (page {} of {})",
        results.len(),
        page,
        (total_count + limit - 1) / limit
    );

    Ok(Json(PaginatedArchivedMessages {
        data: results,
        total: total_count,
        page,
        limit,
    }))
}

#[delete("/admin/api/archived/messages/<id>")]
pub async fn permanently_delete_archived_message(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    id: i64,
) -> AppResult<Status> {
    if !is_admin_authenticated(cookies, &mut db, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    diesel::delete(messages_archive::table.find(id))
        .execute(&mut db)
        .await
        .map_err(|e| {
            error!("Error permanently deleting archived message {}: {}", id, e);
            AppError::from(e)
        })?;

    info!("Archived message {} permanently deleted", id);
    Ok(Status::Ok)
}
