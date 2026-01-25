// Main application entry point

#[macro_use]
extern crate rocket;

mod config;
mod db;
mod models;
mod routes;
mod schema;

use rocket::fairing::AdHoc;
use rocket::fs::FileServer;
use rocket_db_pools::Database;

use config::AppConfig;
use db::MessagesDB;
use models::AppState;
use routes::{admin, contact};

#[rocket::launch]
fn rocket() -> _ {
    let app_config = AppConfig::load();

    if app_config.admin_password_hash.is_empty() {
        eprintln!("WARNING: ADMIN_PASSWORD_HASH is not set. Admin login will be disabled.");
    }

    let figment = rocket::config::Config::figment()
        .merge(("port", app_config.rocket_port))
        .merge(("address", app_config.rocket_address.clone()))
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
        .manage(AppState {
            admin_password_hash: app_config.admin_password_hash,
        })
        .attach(MessagesDB::init())
        .attach(AdHoc::on_ignite("Database Migrations", db::run_migrations))
        .mount("/", routes![contact::submit_message])
        .mount(
            "/",
            routes![
                admin::admin_login,
                admin::admin_logout,
                admin::admin_check,
                admin::get_messages,
                admin::delete_message,
                admin::list_offers,
                admin::get_offer_image,
                admin::create_offer,
                admin::delete_offer,
                admin::update_offer,
            ],
        )
        .mount("/", FileServer::from(&static_dir))
        .register("/", catchers![routes::not_found])
}
