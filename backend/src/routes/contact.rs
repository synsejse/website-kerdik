// Contact form submission route handler

use rocket::form::Form;
use rocket::http::Status;
use rocket_db_pools::Connection;
use rocket_db_pools::diesel::prelude::*;

use crate::db::MessagesDB;
use crate::models::{ContactMessage, ContactMessageForm};
use crate::schema::messages;

/// Handle contact form submission
#[post("/contact/message", data = "<form>")]
pub async fn submit_message(
    mut db: Connection<MessagesDB>,
    form: Form<ContactMessageForm>,
) -> Result<Status, Status> {
    let data = form.into_inner();

    // Check honeypot field to detect bots
    if data.is_bot() {
        println!("⚠️  Bot detected, ignoring submission");
        return Err(Status::BadRequest);
    }

    // Basic input validation
    if data.name.trim().is_empty() || data.message.trim().is_empty() {
        return Err(Status::BadRequest);
    }

    if !data.email.contains('@') || data.email.trim().len() < 5 {
        return Err(Status::BadRequest);
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
        Ok(_) => Ok(Status::Ok),
        Err(e) => {
            eprintln!("❌ Failed to save contact message: {}", e);
            Err(Status::InternalServerError)
        }
    }
}
