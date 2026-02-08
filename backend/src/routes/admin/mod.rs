// Admin routes module

pub mod archive;
pub mod auth;
pub mod blog;
pub mod messages;
pub mod offers;

// Re-export commonly used items for convenience
pub use archive::{get_archived_messages, permanently_delete_archived_message};
pub use auth::{admin_check, admin_login, admin_logout};
pub use blog::{
    create_blog_post, delete_blog_post, get_blog_post_by_slug, get_blog_post_image,
    list_all_blog_posts, list_blog_posts, update_blog_post,
};
pub use messages::{archive_message, delete_message, get_messages};
pub use offers::{create_offer, delete_offer, get_offer_image, list_offers, update_offer};
