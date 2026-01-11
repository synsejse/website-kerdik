// Data models for contact messages

use chrono::NaiveDateTime;
use rocket::form::FromForm;
use rocket::serde::{Deserialize, Serialize};
use rocket_db_pools::diesel::prelude::*;

use crate::schema::{admin_sessions, messages};

/// Form data received from the contact form
#[derive(Debug, Clone, Deserialize, Serialize, FromForm)]
#[serde(crate = "rocket::serde")]
pub struct ContactMessageForm {
    pub company: Option<String>, // Anti-bot honeypot field
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
    pub subject: Option<String>,
    pub message: String,
}

/// Database representation of a contact message
#[derive(Insertable)]
#[diesel(table_name = messages)]
pub struct ContactMessage {
    pub id: Option<i64>,
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
    pub subject: Option<String>,
    pub message: String,
}

impl From<ContactMessageForm> for ContactMessage {
    fn from(form: ContactMessageForm) -> Self {
        ContactMessage {
            id: None,
            name: form.name,
            email: form.email,
            phone: form.phone,
            subject: form.subject,
            message: form.message,
        }
    }
}

impl ContactMessageForm {
    /// Check if this submission is likely from a bot
    pub fn is_bot(&self) -> bool {
        self.company.as_ref().is_some_and(|c| !c.is_empty())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Queryable, Selectable)]
#[diesel(table_name = messages)]
pub struct Message {
    pub id: i64,
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
    pub subject: Option<String>,
    pub message: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Insertable)]
#[diesel(table_name = admin_sessions)]
pub struct NewAdminSession {
    pub session_token: String,
    pub expires_at: Option<NaiveDateTime>,
    pub ip_address: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct AdminLoginRequest {
    pub password: String,
}

pub struct AppState {
    pub admin_password_hash: String,
}

#[derive(Debug, Clone, Queryable, Selectable)]
#[diesel(table_name = admin_sessions)]
pub struct AdminSession {
    pub session_token: String,
    pub created_at: Option<NaiveDateTime>,
    pub expires_at: Option<NaiveDateTime>,
    pub ip_address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct PaginatedMessages {
    pub data: Vec<Message>,
    pub total: i64,
    pub page: i64,
    pub limit: i64,
}
