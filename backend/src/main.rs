#[macro_use]
extern crate rocket;
use rocket::fs::{FileServer, NamedFile};

#[catch(404)]
async fn not_found() -> Option<NamedFile> {
    NamedFile::open("/app/static/404.html").await.ok()
}

#[rocket::launch]
fn rocket() -> _ {
    rocket::build()
        .mount("/", FileServer::from("/app/static"))
        .register("/", catchers![not_found])
}
