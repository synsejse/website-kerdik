// Admin routes module

pub mod archive;
pub mod auth;
pub mod banner;
pub mod blog;
pub mod messages;
pub mod offers;
pub mod users;

// Re-export commonly used items for convenience
pub use archive::{get_archived_messages, permanently_delete_archived_message};
pub use auth::{admin_login, admin_logout, admin_status};
pub use banner::{delete_banner, get_active_banner, get_admin_banner, upsert_banner};
pub use blog::{
    create_blog_post, delete_blog_post, get_blog_post_by_slug, get_blog_post_image,
    list_all_blog_posts, list_blog_posts, update_blog_post,
};
pub use messages::{archive_message, delete_message, get_messages};
pub use offers::{
    create_offer, delete_offer, get_offer_by_slug, get_offer_image, list_offers, update_offer,
};
pub use users::{
    accept_admin_invite, admin_setup, create_admin_invite, create_admin_user, delete_admin_invite,
    delete_admin_user, get_admin_invite_status, list_admin_invites, list_admin_users,
    update_admin_user,
};
