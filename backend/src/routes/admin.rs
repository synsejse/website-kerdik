use bcrypt::verify;
use rocket::State;
use rocket::http::{ContentType, Cookie, CookieJar, SameSite, Status};
use rocket::serde::json::Json;
use rocket_db_pools::Connection;
use rocket_db_pools::diesel::prelude::*;
use std::net::SocketAddr;
use std::str::FromStr;
use uuid::Uuid;

use rocket::form::Form;
use rocket::tokio::io::AsyncReadExt;

use crate::db::MessagesDB;
use crate::models::{
    AdminCreateOfferMultipart, AdminLoginRequest, AdminSession, AdminUpdateOfferMultipart,
    AppState, Message, NewAdminSession, NewOffer, Offer, OfferDto, PaginatedMessages,
};
use crate::schema::{admin_sessions, messages, offers};

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
            if let Some(expires_at) = session.expires_at
                && expires_at < chrono::Utc::now().naive_utc()
            {
                return false;
            }

            // Check if IP address matches
            if let Some(saved_ip) = session.ip_address {
                if let Some(current_ip) = remote_addr {
                    if saved_ip != current_ip.ip().to_string() {
                        return false;
                    }
                } else {
                    // Session has an IP but requester has no IP detected
                    return false;
                }
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

#[get("/admin/api/messages?<page>&<limit>")]
pub async fn get_messages(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    page: Option<i64>,
    limit: Option<i64>,
) -> Result<Json<PaginatedMessages>, Status> {
    if !is_admin_authenticated(cookies, &mut db, remote_addr).await {
        return Err(Status::Unauthorized);
    }

    let page = page.unwrap_or(1);
    let limit = limit.unwrap_or(10);
    let offset = (page - 1) * limit;

    let total_count: i64 = messages::table
        .count()
        .get_result(&mut db)
        .await
        .map_err(|e| {
            eprintln!("Error counting messages: {}", e);
            Status::InternalServerError
        })?;

    let results = messages::table
        .order(messages::created_at.desc())
        .limit(limit)
        .offset(offset)
        .select(Message::as_select())
        .load(&mut db)
        .await
        .map_err(|e| {
            eprintln!("Error loading messages: {}", e);
            Status::InternalServerError
        })?;

    Ok(Json(PaginatedMessages {
        data: results,
        total: total_count,
        page,
        limit,
    }))
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

//
// Offers - admin endpoints
//

#[post("/admin/api/offers", data = "<offer_form>")]
pub async fn create_offer(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    offer_form: Form<AdminCreateOfferMultipart<'_>>,
) -> Result<Json<OfferDto>, Status> {
    if !is_admin_authenticated(cookies, &mut db, remote_addr).await {
        return Err(Status::Unauthorized);
    }

    let offer = offer_form.into_inner();

    // Process image if uploaded
    let (image_bytes, image_mime) = match offer.image {
        Some(temp_file) => {
            // Validate content type is an image we accept
            let ct = temp_file
                .content_type()
                .filter(|ct| ct.is_jpeg() || ct.is_png() || ct.is_gif())
                .ok_or(Status::UnsupportedMediaType)?;

            let mut buffer = Vec::new();
            temp_file
                .open()
                .await
                .map_err(|_| Status::InternalServerError)?
                .read_to_end(&mut buffer)
                .await
                .map_err(|_| Status::InternalServerError)?;

            (Some(buffer), Some(ct.to_string()))
        }
        _ => (None, None),
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
            eprintln!("Error inserting offer: {}", e);
            Status::InternalServerError
        })?;

    // Retrieve inserted row by slug (slug should be unique)
    let inserted = offers::table
        .filter(offers::slug.eq(&new_offer.slug))
        .select(Offer::as_select())
        .first::<Offer>(&mut db)
        .await
        .map_err(|e| {
            eprintln!("Error fetching created offer: {}", e);
            Status::InternalServerError
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

    Ok(Json(dto))
}

#[put("/admin/api/offers/<id>", data = "<update_form>")]
pub async fn update_offer(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    id: i64,
    update_form: Form<AdminUpdateOfferMultipart<'_>>,
) -> Result<Status, Status> {
    if !is_admin_authenticated(cookies, &mut db, remote_addr).await {
        return Err(Status::Unauthorized);
    }

    let update_data = update_form.into_inner();
    let target = offers::table.find(id);

    // Check if offer exists
    let _existing_offer: Offer = offers::table
        .find(id)
        .first(&mut db)
        .await
        .map_err(|_| Status::NotFound)?;

    let update_values = match update_data.image {
        Some(temp_file) => {
            // New image uploaded – validate MIME type
            let ct = temp_file
                .content_type()
                .filter(|ct| ct.is_jpeg() || ct.is_png() || ct.is_gif())
                .ok_or(Status::UnsupportedMediaType)?;

            let mut buffer = Vec::new();
            temp_file
                .open()
                .await
                .map_err(|_| Status::InternalServerError)?
                .read_to_end(&mut buffer)
                .await
                .map_err(|_| Status::InternalServerError)?;

            // Update with new image
            diesel::update(target)
                .set((
                    offers::title.eq(&update_data.title),
                    offers::slug.eq(&update_data.slug),
                    offers::description.eq(&update_data.description),
                    offers::link.eq(&update_data.link),
                    offers::image.eq(buffer),
                    offers::image_mime.eq(Some(ct.to_string())),
                ))
                .execute(&mut db)
                .await
        }
        _ if update_data.keep_existing_image.unwrap_or(false) => {
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
        _ => {
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

    match update_values {
        Ok(_) => Ok(Status::Ok),
        Err(e) => {
            eprintln!("Error updating offer: {}", e);
            Err(Status::InternalServerError)
        }
    }
}

#[delete("/admin/api/offers/<id>")]
pub async fn delete_offer(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    id: i64,
) -> Result<Status, Status> {
    if !is_admin_authenticated(cookies, &mut db, remote_addr).await {
        return Err(Status::Unauthorized);
    }

    diesel::delete(offers::table.find(id))
        .execute(&mut db)
        .await
        .map_err(|e| {
            eprintln!("Error deleting offer: {}", e);
            Status::InternalServerError
        })?;

    Ok(Status::Ok)
}

#[get("/api/offers")]
pub async fn list_offers(mut db: Connection<MessagesDB>) -> Result<Json<Vec<OfferDto>>, Status> {
    let results = offers::table
        .order(offers::created_at.desc())
        .select(Offer::as_select())
        .load::<Offer>(&mut db)
        .await
        .map_err(|_| Status::InternalServerError)?;

    let dtos = results
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

    Ok(Json(dtos))
}

#[get("/api/offers/<id>/image")]
pub async fn get_offer_image(
    mut db: Connection<MessagesDB>,
    id: i64,
) -> Result<(ContentType, Vec<u8>), Status> {
    let offer = offers::table
        .find(id)
        .first::<Offer>(&mut db)
        .await
        .map_err(|_| Status::NotFound)?;

    if let Some(image_bytes) = offer.image {
        let content_type = offer
            .image_mime
            .and_then(|m| ContentType::from_str(&m).ok())
            .unwrap_or(ContentType::JPEG);

        Ok((content_type, image_bytes))
    } else {
        Err(Status::NotFound)
    }
}
