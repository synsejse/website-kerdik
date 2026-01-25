// Active message management endpoints

use rocket::http::{CookieJar, Status};
use rocket::serde::json::Json;
use rocket_db_pools::Connection;
use rocket_db_pools::diesel::prelude::*;
use std::net::SocketAddr;
use tracing::{error, info, warn};

use crate::db::MessagesDB;
use crate::error::{AppError, AppResult};
use crate::models::{
    ArchiveAction, ArchiveRequest, ArchivedMessage, ContactMessage, Message, PaginatedMessages,
};
use crate::routes::admin::auth::is_admin_authenticated;
use crate::schema::{messages, messages_archive};

#[get("/admin/api/messages?<page>&<limit>")]
pub async fn get_messages(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    page: Option<i64>,
    limit: Option<i64>,
) -> AppResult<Json<PaginatedMessages>> {
    if !is_admin_authenticated(cookies, &mut db, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    let page = page.unwrap_or(1);
    let limit = limit.unwrap_or(10);
    let offset = (page - 1) * limit;

    let total_count: i64 = messages::table
        .count()
        .get_result(&mut db)
        .await
        .map_err(|e| {
            error!("Error counting messages: {}", e);
            AppError::from(e)
        })?;

    let results = messages::table
        .order(messages::created_at.desc())
        .limit(limit)
        .offset(offset)
        .select(Message::as_select())
        .load(&mut db)
        .await
        .map_err(|e| {
            error!("Error loading messages: {}", e);
            AppError::from(e)
        })?;

    info!(
        "Retrieved {} messages (page {} of {})",
        results.len(),
        page,
        (total_count + limit - 1) / limit
    );

    Ok(Json(PaginatedMessages {
        data: results,
        total: total_count,
        page,
        limit,
    }))
}

#[post(
    "/admin/api/messages/<id>/archive",
    format = "json",
    data = "<request>"
)]
pub async fn archive_message(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    id: i64,
    request: Json<ArchiveRequest>,
) -> AppResult<Status> {
    if !is_admin_authenticated(cookies, &mut db, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    let action = match request.action.as_str() {
        "archive" => ArchiveAction::Archive,
        "restore" => ArchiveAction::Restore,
        _ => {
            warn!("Invalid archive action requested: {}", request.action);
            return Err(AppError::InvalidInput("Invalid archive action".to_string()));
        }
    };

    match action {
        ArchiveAction::Archive => {
            // Get the message first
            let message: Message = messages::table
                .find(id)
                .select(Message::as_select())
                .first(&mut db)
                .await
                .map_err(|e| {
                    error!("Error retrieving message for archiving: {}", e);
                    AppError::NotFound
                })?;

            // Create archived message
            let archived_message = message.into_archived();

            // Start transaction: insert into archive, then delete original
            db.transaction(|mut conn| {
                Box::pin(async move {
                    diesel::insert_into(messages_archive::table)
                        .values(&archived_message)
                        .execute(&mut conn)
                        .await?;

                    diesel::delete(messages::table.find(id))
                        .execute(&mut conn)
                        .await?;

                    Ok::<_, diesel::result::Error>(())
                })
            })
            .await
            .map_err(|e| {
                error!("Error archiving message in transaction: {}", e);
                AppError::from(e)
            })?;

            info!("Message {} archived successfully", id);
            Ok(Status::Ok)
        }
        ArchiveAction::Restore => {
            // Find the most recent archived record for the original id
            let archived: ArchivedMessage = messages_archive::table
                .filter(messages_archive::original_id.eq(id))
                .order(messages_archive::archived_at.desc())
                .select(ArchivedMessage::as_select())
                .first(&mut db)
                .await
                .map_err(|e| {
                    error!("Error retrieving archived message for restoration: {}", e);
                    AppError::NotFound
                })?;

            // Convert back to regular message (attempt to restore original id)
            let message = ContactMessage {
                id: Some(archived.original_id),
                name: archived.name,
                email: archived.email,
                phone: archived.phone,
                subject: archived.subject,
                message: archived.message,
            };

            // Start transaction: insert back into messages, delete archive record
            db.transaction(|mut conn| {
                Box::pin(async move {
                    diesel::insert_into(messages::table)
                        .values(&message)
                        .execute(&mut conn)
                        .await?;

                    diesel::delete(messages_archive::table.find(archived.id))
                        .execute(&mut conn)
                        .await?;

                    Ok::<_, diesel::result::Error>(())
                })
            })
            .await
            .map_err(|e| {
                error!("Error restoring message in transaction: {}", e);
                AppError::from(e)
            })?;

            info!("Message {} restored from archive successfully", id);
            Ok(Status::Ok)
        }
    }
}

/// Update delete_message to archive instead of hard-delete
#[delete("/admin/api/messages/<id>")]
pub async fn delete_message(
    db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    id: i64,
) -> AppResult<Status> {
    info!("Request to delete (archive) message {}", id);
    // Instead of deleting, archive the message
    let archive_request = Json(ArchiveRequest {
        action: "archive".to_string(),
    });

    archive_message(db, cookies, remote_addr, id, archive_request).await
}
