// Contact form submission route handler

use rocket::form::Form;
use rocket::http::Status;
use rocket_db_pools::Connection;
use rocket_db_pools::diesel::prelude::*;
use tracing::{debug, error, warn};

use crate::db::MessagesDB;
use crate::error::{AppError, AppResult};
use crate::models::{ContactMessage, ContactMessageForm};
use crate::schema::messages;
use crate::utils::{validate_email, validate_not_empty};

/// Handle contact form submission
#[post("/contact/message", data = "<form>")]
pub async fn submit_message(
    mut db: Connection<MessagesDB>,
    form: Form<ContactMessageForm>,
) -> AppResult<Status> {
    let data = form.into_inner();

    // Check honeypot field to detect bots
    if data.is_bot() {
        warn!("Bot detected in contact form submission");
        return Err(AppError::InvalidInput(
            "Bot submission rejected".to_string(),
        ));
    }

    // Validate inputs
    if !validate_not_empty(&data.name) {
        debug!("Contact form validation failed: empty name");
        return Err(AppError::InvalidInput("Name is required".to_string()));
    }

    if !validate_not_empty(&data.message) {
        debug!("Contact form validation failed: empty message");
        return Err(AppError::InvalidInput("Message is required".to_string()));
    }

    if !validate_email(&data.email) {
        debug!("Contact form validation failed: invalid email");
        return Err(AppError::InvalidInput(
            "Valid email is required".to_string(),
        ));
    }

    // Insert message into database
    let result = db
        .transaction(|mut conn| {
            Box::pin(async move {
                diesel::insert_into(messages::table)
                    .values(ContactMessage::from(data))
                    .execute(&mut conn)
                    .await?;

                Ok::<_, diesel::result::Error>(())
            })
        })
        .await;

    match result {
        Ok(_) => {
            debug!("Contact message saved successfully");
            Ok(Status::Ok)
        }
        Err(e) => {
            error!("Failed to save contact message: {}", e);
            Err(AppError::from(e))
        }
    }
}
