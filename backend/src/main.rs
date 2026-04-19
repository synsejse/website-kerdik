// Main application entry point

#[macro_use]
extern crate rocket;

mod config;
mod db;
mod error;
mod models;
mod routes;
mod schema;
mod utils;

use rocket::fairing::AdHoc;
use rocket::fs::FileServer;
use rocket_db_pools::Database;

use config::AppConfig;
use db::MessagesDB;
use routes::{admin, contact};

#[rocket::launch]
fn rocket() -> _ {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    let app_config = AppConfig::load();
    let redis_client =
        redis::Client::open(app_config.redis_url.clone()).expect("Invalid REDIS_URL configuration");

    let figment = rocket::Config::figment()
        .merge(("port", app_config.rocket_port))
        .merge(("address", app_config.rocket_address.clone()))
        .merge(("limits.data-form", 10 * 1024 * 1024)) // 10 MB for form data (images will be compressed)
        .merge(("limits.file", 10 * 1024 * 1024)) // 10 MB for file uploads
        .merge((
            "databases.messages_db",
            rocket_db_pools::Config {
                url: app_config.database_url.clone(),
                min_connections: None,
                max_connections: 1024,
                connect_timeout: 3,
                idle_timeout: None,
                extensions: None,
            },
        ));

    let static_dir = app_config.static_dir.clone();

    rocket::custom(figment)
        .manage(redis_client)
        .attach(MessagesDB::init())
        .attach(AdHoc::on_ignite("Database Migrations", db::run_migrations))
        .mount("/", routes![contact::submit_message])
        .mount(
            "/",
            routes![
                admin::admin_login,
                admin::admin_logout,
                admin::admin_check,
                admin::admin_status,
                admin::admin_setup,
                admin::get_admin_invite_status,
                admin::accept_admin_invite,
                admin::get_messages,
                admin::delete_message,
                admin::archive_message,
                admin::get_archived_messages,
                admin::permanently_delete_archived_message,
                admin::list_offers,
                admin::get_offer_by_slug,
                admin::get_offer_image,
                admin::create_offer,
                admin::delete_offer,
                admin::update_offer,
                admin::list_blog_posts,
                admin::list_all_blog_posts,
                admin::get_blog_post_by_slug,
                admin::get_blog_post_image,
                admin::create_blog_post,
                admin::update_blog_post,
                admin::delete_blog_post,
                admin::list_admin_users,
                admin::create_admin_user,
                admin::update_admin_user,
                admin::delete_admin_user,
                admin::list_admin_invites,
                admin::create_admin_invite,
                admin::delete_admin_invite,
                admin::get_active_emergency_banner,
                admin::get_admin_emergency_banner,
                admin::upsert_emergency_banner,
                admin::delete_emergency_banner,
                routes::offer_detail_page,
                routes::blog_detail_page,
            ],
        )
        .mount("/", FileServer::from(&static_dir))
        .register("/", catchers![routes::not_found])
}
