// Routes module - organizes all HTTP route handlers

pub mod admin;
pub mod contact;

use rocket::fs::NamedFile;
use std::path::PathBuf;

use crate::config::AppConfig;

fn static_file_path(relative_path: &str) -> PathBuf {
    let config = AppConfig::load();
    PathBuf::from(config.static_dir).join(relative_path)
}

#[get("/offer/<_slug>")]
pub async fn offer_detail_page(_slug: &str) -> Option<NamedFile> {
    NamedFile::open(static_file_path("offer-detail/index.html"))
        .await
        .ok()
}

#[get("/blog/<_slug>")]
pub async fn blog_detail_page(_slug: &str) -> Option<NamedFile> {
    NamedFile::open(static_file_path("blog/post/index.html"))
        .await
        .ok()
}

/// 404 error handler - serves custom 404.html page
#[catch(404)]
pub async fn not_found() -> Option<NamedFile> {
    NamedFile::open(static_file_path("404.html")).await.ok()
}
