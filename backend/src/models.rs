// Data models for contact messages

use chrono::NaiveDateTime;
use rocket::form::FromForm;
use rocket::fs::TempFile;
use rocket::serde::{Deserialize, Serialize};
use rocket_db_pools::diesel::prelude::*;

use crate::schema::{admin_sessions, messages, messages_archive, offers};

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

#[derive(Debug, Clone, Queryable, Selectable, Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
#[diesel(table_name = messages_archive)]
pub struct ArchivedMessage {
    pub id: i64,
    pub original_id: i64,
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
    pub subject: Option<String>,
    pub message: String,
    pub created_at: NaiveDateTime,
    pub archived_at: NaiveDateTime,
}

#[derive(Debug, Clone, Insertable)]
#[diesel(table_name = messages_archive)]
pub struct NewArchivedMessage {
    pub original_id: i64,
    pub name: String,
    pub email: String,
    pub phone: Option<String>,
    pub subject: Option<String>,
    pub message: String,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
pub enum ArchiveAction {
    Archive,
    Restore,
}

#[derive(Debug, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct ArchiveRequest {
    pub action: String,
}

impl Message {
    /// Convert a Message into a NewArchivedMessage suitable for inserting into
    /// the `messages_archive` table. This intentionally does NOT include an
    /// `archived_by` field per request.
    pub fn into_archived(self) -> NewArchivedMessage {
        NewArchivedMessage {
            original_id: self.id,
            name: self.name,
            email: self.email,
            phone: self.phone,
            subject: self.subject,
            message: self.message,
            created_at: self.created_at,
        }
    }
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
#[allow(dead_code)]
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

//
// Offers - DB models and DTOs
//

#[derive(Debug, Clone, Queryable, Selectable)]
#[diesel(table_name = offers)]
pub struct Offer {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub description: Option<String>,
    pub link: Option<String>,
    pub image: Option<Vec<u8>>,
    pub image_mime: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, Clone, Insertable)]
#[diesel(table_name = offers)]
pub struct NewOffer {
    pub title: String,
    pub slug: String,
    pub description: Option<String>,
    pub link: Option<String>,
    pub image: Option<Vec<u8>>,
    pub image_mime: Option<String>,
}

/// DTO used by the frontend / API for returning offer data.
/// Images are represented by `image_mime` and served via a separate
/// image endpoint; handlers may inline images when necessary.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct OfferDto {
    pub id: i64,
    pub title: String,
    pub slug: String,
    pub description: Option<String>,
    pub link: Option<String>,
    pub image_mime: Option<String>,
    pub created_at: NaiveDateTime,
}

#[derive(Debug, FromForm)]
pub struct AdminCreateOfferMultipart<'r> {
    pub title: String,
    pub slug: String,
    pub description: Option<String>,
    pub link: Option<String>,
    /// Image uploaded as file instead of base64
    #[field(name = "image")]
    pub image: Option<TempFile<'r>>,
}

#[derive(Debug, FromForm)]
pub struct AdminUpdateOfferMultipart<'r> {
    pub title: String,
    pub slug: String,
    pub description: Option<String>,
    pub link: Option<String>,
    /// Optional: Only provided if the user uploaded a new image
    #[field(name = "image")]
    pub image: Option<TempFile<'r>>,
    /// Keep existing image if true and no new image provided
    pub keep_existing_image: Option<bool>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_contact_message_form_is_bot() {
        // Test bot detection with company field filled
        let bot_form = ContactMessageForm {
            company: Some("spam".to_string()),
            name: "Spam Bot".to_string(),
            email: "bot@spam.com".to_string(),
            phone: None,
            subject: None,
            message: "Spam message".to_string(),
        };
        assert!(bot_form.is_bot());

        // Test legitimate submission
        let legit_form = ContactMessageForm {
            company: None,
            name: "John Doe".to_string(),
            email: "john@example.com".to_string(),
            phone: None,
            subject: Some("Test".to_string()),
            message: "Hello, this is a test".to_string(),
        };
        assert!(!legit_form.is_bot());

        // Test with empty company field
        let empty_company = ContactMessageForm {
            company: Some("".to_string()),
            name: "Jane Doe".to_string(),
            email: "jane@example.com".to_string(),
            phone: None,
            subject: None,
            message: "Another test".to_string(),
        };
        assert!(!empty_company.is_bot());
    }

    #[test]
    fn test_contact_message_from_form() {
        let form = ContactMessageForm {
            company: None,
            name: "Alice".to_string(),
            email: "alice@example.com".to_string(),
            phone: Some("123-456-7890".to_string()),
            subject: Some("Question".to_string()),
            message: "I have a question about your services".to_string(),
        };

        let contact = ContactMessage::from(form.clone());

        assert_eq!(contact.id, None);
        assert_eq!(contact.name, form.name);
        assert_eq!(contact.email, form.email);
        assert_eq!(contact.phone, form.phone);
        assert_eq!(contact.subject, form.subject);
        assert_eq!(contact.message, form.message);
    }

    #[test]
    fn test_message_into_archived() {
        use chrono::NaiveDateTime;

        let created_at = NaiveDateTime::parse_from_str("2024-01-01 12:00:00", "%Y-%m-%d %H:%M:%S")
            .expect("Failed to parse datetime");

        let message = Message {
            id: 123,
            name: "Bob".to_string(),
            email: "bob@example.com".to_string(),
            phone: None,
            subject: Some("Inquiry".to_string()),
            message: "Interested in your product".to_string(),
            created_at,
        };

        let archived = message.clone().into_archived();

        assert_eq!(archived.original_id, message.id);
        assert_eq!(archived.name, message.name);
        assert_eq!(archived.email, message.email);
        assert_eq!(archived.phone, message.phone);
        assert_eq!(archived.subject, message.subject);
        assert_eq!(archived.message, message.message);
        assert_eq!(archived.created_at, message.created_at);
    }
}
