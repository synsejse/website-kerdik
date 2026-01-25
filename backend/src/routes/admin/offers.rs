// Offer management endpoints (admin and public)

use rocket::form::Form;
use rocket::http::{ContentType, CookieJar, Status};
use rocket::serde::json::Json;
use rocket_db_pools::Connection;
use rocket_db_pools::diesel::prelude::*;
use std::net::SocketAddr;
use std::str::FromStr;
use tracing::{error, info};

use crate::db::MessagesDB;
use crate::error::{AppError, AppResult};
use crate::models::{
    AdminCreateOfferMultipart, AdminUpdateOfferMultipart, NewOffer, Offer, OfferDto,
};
use crate::routes::admin::auth::is_admin_authenticated;
use crate::schema::offers;
use crate::utils::process_image_upload;

#[post("/admin/api/offers", data = "<offer_form>")]
pub async fn create_offer(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    offer_form: Form<AdminCreateOfferMultipart<'_>>,
) -> AppResult<Json<OfferDto>> {
    if !is_admin_authenticated(cookies, &mut db, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    let offer = offer_form.into_inner();

    // Process image if uploaded
    let (image_bytes, image_mime) = match process_image_upload(offer.image).await? {
        Some((bytes, mime)) => (Some(bytes), Some(mime)),
        None => (None, None),
    };

    let new_offer = NewOffer {
        title: offer.title,
        slug: offer.slug,
        description: offer.description,
        link: offer.link,
        image: image_bytes,
        image_mime,
    };

    // Insert
    diesel::insert_into(offers::table)
        .values(&new_offer)
        .execute(&mut db)
        .await
        .map_err(|e| {
            error!("Error inserting offer: {}", e);
            AppError::from(e)
        })?;

    // Retrieve inserted row by slug (slug should be unique)
    let inserted: Offer = offers::table
        .filter(offers::slug.eq(&new_offer.slug))
        .select(Offer::as_select())
        .first(&mut db)
        .await
        .map_err(|e| {
            error!("Error fetching created offer: {}", e);
            AppError::from(e)
        })?;

    let dto = OfferDto {
        id: inserted.id,
        title: inserted.title,
        slug: inserted.slug,
        description: inserted.description,
        link: inserted.link,
        image_mime: inserted.image_mime,
        created_at: inserted.created_at,
    };

    info!("Offer created successfully with id: {}", inserted.id);
    Ok(Json(dto))
}

#[put("/admin/api/offers/<id>", data = "<update_form>")]
pub async fn update_offer(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    id: i64,
    update_form: Form<AdminUpdateOfferMultipart<'_>>,
) -> AppResult<Status> {
    if !is_admin_authenticated(cookies, &mut db, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    let update_data = update_form.into_inner();
    let target = offers::table.find(id);

    // Check if offer exists
    let _existing_offer: Offer = offers::table.find(id).first(&mut db).await.map_err(|e| {
        error!("Error checking for existing offer {}: {}", id, e);
        AppError::NotFound
    })?;

    let update_values = match process_image_upload(update_data.image).await? {
        Some((buffer, ct_string)) => {
            // Update with new image
            diesel::update(target)
                .set((
                    offers::title.eq(&update_data.title),
                    offers::slug.eq(&update_data.slug),
                    offers::description.eq(&update_data.description),
                    offers::link.eq(&update_data.link),
                    offers::image.eq(buffer),
                    offers::image_mime.eq(Some(ct_string)),
                ))
                .execute(&mut db)
                .await
        }
        None if update_data.keep_existing_image.unwrap_or(false) => {
            // Keep existing image
            diesel::update(target)
                .set((
                    offers::title.eq(&update_data.title),
                    offers::slug.eq(&update_data.slug),
                    offers::description.eq(&update_data.description),
                    offers::link.eq(&update_data.link),
                ))
                .execute(&mut db)
                .await
        }
        None => {
            // Remove existing image
            diesel::update(target)
                .set((
                    offers::title.eq(&update_data.title),
                    offers::slug.eq(&update_data.slug),
                    offers::description.eq(&update_data.description),
                    offers::link.eq(&update_data.link),
                    offers::image.eq(None::<Vec<u8>>),
                    offers::image_mime.eq(None::<String>),
                ))
                .execute(&mut db)
                .await
        }
    };

    update_values.map_err(|e| {
        error!("Error updating offer {}: {}", id, e);
        AppError::from(e)
    })?;

    info!("Offer {} updated successfully", id);
    Ok(Status::Ok)
}

#[delete("/admin/api/offers/<id>")]
pub async fn delete_offer(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    id: i64,
) -> AppResult<Status> {
    if !is_admin_authenticated(cookies, &mut db, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    diesel::delete(offers::table.find(id))
        .execute(&mut db)
        .await
        .map_err(|e| {
            error!("Error deleting offer {}: {}", id, e);
            AppError::from(e)
        })?;

    info!("Offer {} deleted successfully", id);
    Ok(Status::Ok)
}

#[get("/api/offers")]
pub async fn list_offers(mut db: Connection<MessagesDB>) -> AppResult<Json<Vec<OfferDto>>> {
    let results: Vec<Offer> = offers::table
        .order(offers::created_at.desc())
        .select(Offer::as_select())
        .load(&mut db)
        .await
        .map_err(|e| {
            error!("Error loading offers: {}", e);
            AppError::from(e)
        })?;

    let dtos: Vec<OfferDto> = results
        .into_iter()
        .map(|o| OfferDto {
            id: o.id,
            title: o.title,
            slug: o.slug,
            description: o.description,
            link: o.link,
            image_mime: o.image_mime,
            created_at: o.created_at,
        })
        .collect();

    info!("Retrieved {} offers", dtos.len());
    Ok(Json(dtos))
}

#[get("/api/offers/<id>/image")]
pub async fn get_offer_image(
    mut db: Connection<MessagesDB>,
    id: i64,
) -> AppResult<(ContentType, Vec<u8>)> {
    let offer: Offer = offers::table.find(id).first(&mut db).await.map_err(|e| {
        error!("Error fetching offer {} for image: {}", id, e);
        AppError::NotFound
    })?;

    if let Some(image_bytes) = offer.image {
        let content_type = offer
            .image_mime
            .and_then(|m| ContentType::from_str(&m).ok())
            .unwrap_or(ContentType::JPEG);

        Ok((content_type, image_bytes))
    } else {
        Err(AppError::NotFound)
    }
}
