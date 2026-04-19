use rocket::State;
use rocket::http::{CookieJar, Status};
use rocket::serde::json::Json;
use rocket_db_pools::Connection;
use rocket_db_pools::diesel::prelude::*;
use std::net::SocketAddr;

use crate::db::MessagesDB;
use crate::error::{AppError, AppResult};
use crate::models::{
    AdminUpsertEmergencyBannerRequest, EmergencyBanner, EmergencyBannerDto, NewEmergencyBanner,
};
use crate::routes::admin::auth::is_admin_authenticated;
use crate::schema::emergency_banners;

fn to_banner_dto(banner: EmergencyBanner) -> EmergencyBannerDto {
    EmergencyBannerDto {
        id: banner.id,
        title: banner.title,
        message: banner.message,
        tone: banner.tone,
        link_label: banner.link_label,
        link_url: banner.link_url,
        is_active: banner.is_active,
        created_at: banner.created_at,
        updated_at: banner.updated_at,
    }
}

fn normalize_tone(tone: &str) -> AppResult<String> {
    let normalized = tone.trim().to_lowercase();
    match normalized.as_str() {
        "critical" | "warning" | "info" => Ok(normalized),
        _ => Err(AppError::InvalidInput(
            "Tone must be one of: critical, warning, info.".to_string(),
        )),
    }
}

async fn get_current_banner_row(
    db: &mut Connection<MessagesDB>,
) -> AppResult<Option<EmergencyBanner>> {
    Ok(emergency_banners::table
        .order(emergency_banners::updated_at.desc())
        .select(EmergencyBanner::as_select())
        .first(db)
        .await
        .optional()?)
}

#[get("/api/emergency-banner")]
pub async fn get_active_emergency_banner(
    mut db: Connection<MessagesDB>,
) -> AppResult<Json<Option<EmergencyBannerDto>>> {
    let banner = emergency_banners::table
        .filter(emergency_banners::is_active.eq(true))
        .order(emergency_banners::updated_at.desc())
        .select(EmergencyBanner::as_select())
        .first(&mut db)
        .await
        .optional()?;

    Ok(Json(banner.map(to_banner_dto)))
}

#[get("/admin/api/emergency-banner")]
pub async fn get_admin_emergency_banner(
    mut db: Connection<MessagesDB>,
    redis: &State<redis::Client>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
) -> AppResult<Json<Option<EmergencyBannerDto>>> {
    if !is_admin_authenticated(cookies, &mut db, redis, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    let banner = get_current_banner_row(&mut db).await?;
    Ok(Json(banner.map(to_banner_dto)))
}

#[put("/admin/api/emergency-banner", format = "json", data = "<request>")]
pub async fn upsert_emergency_banner(
    mut db: Connection<MessagesDB>,
    redis: &State<redis::Client>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    request: Json<AdminUpsertEmergencyBannerRequest>,
) -> AppResult<Json<EmergencyBannerDto>> {
    if !is_admin_authenticated(cookies, &mut db, redis, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    let title = request.title.trim();
    let message = request.message.trim();
    if title.is_empty() || message.is_empty() {
        return Err(AppError::InvalidInput(
            "Banner title and message are required.".to_string(),
        ));
    }

    let tone = normalize_tone(&request.tone)?;
    let link_label = request
        .link_label
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);
    let link_url = request
        .link_url
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string);

    if let Some(existing) = get_current_banner_row(&mut db).await? {
        diesel::update(emergency_banners::table.find(existing.id))
            .set((
                emergency_banners::title.eq(title),
                emergency_banners::message.eq(message),
                emergency_banners::tone.eq(&tone),
                emergency_banners::link_label.eq(link_label.as_deref()),
                emergency_banners::link_url.eq(link_url.as_deref()),
                emergency_banners::is_active.eq(request.is_active),
            ))
            .execute(&mut db)
            .await?;
    } else {
        let new_banner = NewEmergencyBanner {
            title: title.to_string(),
            message: message.to_string(),
            tone: tone.clone(),
            link_label,
            link_url,
            is_active: request.is_active,
        };

        diesel::insert_into(emergency_banners::table)
            .values(&new_banner)
            .execute(&mut db)
            .await?;
    }

    let banner = get_current_banner_row(&mut db)
        .await?
        .ok_or_else(|| AppError::NotFound)?;
    Ok(Json(to_banner_dto(banner)))
}

#[delete("/admin/api/emergency-banner")]
pub async fn delete_emergency_banner(
    mut db: Connection<MessagesDB>,
    redis: &State<redis::Client>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
) -> AppResult<Status> {
    if !is_admin_authenticated(cookies, &mut db, redis, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    if let Some(existing) = get_current_banner_row(&mut db).await? {
        diesel::delete(emergency_banners::table.find(existing.id))
            .execute(&mut db)
            .await?;
    }

    Ok(Status::Ok)
}
