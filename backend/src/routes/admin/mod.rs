// Admin routes module

pub mod archive;
pub mod auth;
pub mod messages;
pub mod offers;

// Re-export commonly used items for convenience
pub use archive::{get_archived_messages, permanently_delete_archived_message};
pub use auth::{admin_check, admin_login, admin_logout};
pub use messages::{archive_message, delete_message, get_messages};
pub use offers::{create_offer, delete_offer, get_offer_image, list_offers, update_offer};
