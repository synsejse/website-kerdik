// Blog post management endpoints (admin and public)

use rocket::form::Form;
use rocket::http::{ContentType, CookieJar, Status};
use rocket::serde::json::Json;
use rocket_db_pools::Connection;
use rocket_db_pools::diesel::prelude::*;
use std::net::SocketAddr;
use tracing::{error, info};

use crate::db::MessagesDB;
use crate::error::{AppError, AppResult};
use crate::models::{
    AdminCreateBlogPostMultipart, AdminUpdateBlogPostMultipart, BlogPost, BlogPostDto, NewBlogPost,
};
use crate::routes::admin::auth::is_admin_authenticated;
use crate::schema::blog_posts;
use crate::utils::process_image_upload;

#[post("/admin/api/blog", data = "<post_form>")]
pub async fn create_blog_post(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    post_form: Form<AdminCreateBlogPostMultipart<'_>>,
) -> AppResult<Json<BlogPostDto>> {
    if !is_admin_authenticated(cookies, &mut db, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    let post = post_form.into_inner();

    // Process image if uploaded
    let (image_bytes, image_mime) = match process_image_upload(post.image).await? {
        Some((bytes, mime)) => (Some(bytes), Some(mime)),
        None => (None, None),
    };

    let new_post = NewBlogPost {
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        image: image_bytes,
        image_mime,
        published: post.published.unwrap_or(false),
    };

    // Insert
    diesel::insert_into(blog_posts::table)
        .values(&new_post)
        .execute(&mut db)
        .await
        .map_err(|e| {
            error!("Error inserting blog post: {}", e);
            AppError::from(e)
        })?;

    // Retrieve inserted row by slug (slug should be unique)
    let inserted: BlogPost = blog_posts::table
        .filter(blog_posts::slug.eq(&new_post.slug))
        .select(BlogPost::as_select())
        .first(&mut db)
        .await
        .map_err(|e| {
            error!("Error fetching created blog post: {}", e);
            AppError::from(e)
        })?;

    let dto = BlogPostDto {
        id: inserted.id,
        title: inserted.title,
        slug: inserted.slug,
        excerpt: inserted.excerpt,
        content: inserted.content,
        image_mime: inserted.image_mime,
        published: inserted.published,
        created_at: inserted.created_at,
        updated_at: inserted.updated_at,
    };

    info!("Blog post created successfully with id: {}", inserted.id);
    Ok(Json(dto))
}

#[put("/admin/api/blog/<id>", data = "<update_form>")]
pub async fn update_blog_post(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    id: i64,
    update_form: Form<AdminUpdateBlogPostMultipart<'_>>,
) -> AppResult<Status> {
    if !is_admin_authenticated(cookies, &mut db, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    let update_data = update_form.into_inner();
    let target = blog_posts::table.find(id);

    // Check if blog post exists
    let _existing_post: BlogPost = blog_posts::table.find(id).first(&mut db).await.map_err(|e| {
        error!("Error checking for existing blog post {}: {}", id, e);
        AppError::NotFound
    })?;

    let published = update_data.published.unwrap_or(false);

    let update_values = match process_image_upload(update_data.image).await? {
        Some((buffer, ct_string)) => {
            // Update with new image
            diesel::update(target)
                .set((
                    blog_posts::title.eq(&update_data.title),
                    blog_posts::slug.eq(&update_data.slug),
                    blog_posts::excerpt.eq(&update_data.excerpt),
                    blog_posts::content.eq(&update_data.content),
                    blog_posts::image.eq(buffer),
                    blog_posts::image_mime.eq(Some(ct_string)),
                    blog_posts::published.eq(published),
                ))
                .execute(&mut db)
                .await
        }
        None => {
            // No new image provided - keep existing image
            diesel::update(target)
                .set((
                    blog_posts::title.eq(&update_data.title),
                    blog_posts::slug.eq(&update_data.slug),
                    blog_posts::excerpt.eq(&update_data.excerpt),
                    blog_posts::content.eq(&update_data.content),
                    blog_posts::published.eq(published),
                ))
                .execute(&mut db)
                .await
        }
    };

    update_values.map_err(|e| {
        error!("Error updating blog post {}: {}", id, e);
        AppError::from(e)
    })?;

    info!("Blog post {} updated successfully", id);
    Ok(Status::Ok)
}

#[delete("/admin/api/blog/<id>")]
pub async fn delete_blog_post(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
    id: i64,
) -> AppResult<Status> {
    if !is_admin_authenticated(cookies, &mut db, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    diesel::delete(blog_posts::table.find(id))
        .execute(&mut db)
        .await
        .map_err(|e| {
            error!("Error deleting blog post {}: {}", id, e);
            AppError::from(e)
        })?;

    info!("Blog post {} deleted successfully", id);
    Ok(Status::Ok)
}

#[get("/api/blog")]
pub async fn list_blog_posts(mut db: Connection<MessagesDB>) -> AppResult<Json<Vec<BlogPostDto>>> {
    let results: Vec<BlogPost> = blog_posts::table
        .filter(blog_posts::published.eq(true))
        .order(blog_posts::created_at.desc())
        .select(BlogPost::as_select())
        .load(&mut db)
        .await
        .map_err(|e| {
            error!("Error loading blog posts: {}", e);
            AppError::from(e)
        })?;

    let dtos: Vec<BlogPostDto> = results
        .into_iter()
        .map(|p| BlogPostDto {
            id: p.id,
            title: p.title,
            slug: p.slug,
            excerpt: p.excerpt,
            content: p.content,
            image_mime: p.image_mime,
            published: p.published,
            created_at: p.created_at,
            updated_at: p.updated_at,
        })
        .collect();

    info!("Retrieved {} published blog posts", dtos.len());
    Ok(Json(dtos))
}

#[get("/admin/api/blog")]
pub async fn list_all_blog_posts(
    mut db: Connection<MessagesDB>,
    cookies: &CookieJar<'_>,
    remote_addr: Option<SocketAddr>,
) -> AppResult<Json<Vec<BlogPostDto>>> {
    if !is_admin_authenticated(cookies, &mut db, remote_addr).await? {
        return Err(AppError::Unauthorized);
    }

    let results: Vec<BlogPost> = blog_posts::table
        .order(blog_posts::created_at.desc())
        .select(BlogPost::as_select())
        .load(&mut db)
        .await
        .map_err(|e| {
            error!("Error loading all blog posts: {}", e);
            AppError::from(e)
        })?;

    let dtos: Vec<BlogPostDto> = results
        .into_iter()
        .map(|p| BlogPostDto {
            id: p.id,
            title: p.title,
            slug: p.slug,
            excerpt: p.excerpt,
            content: p.content,
            image_mime: p.image_mime,
            published: p.published,
            created_at: p.created_at,
            updated_at: p.updated_at,
        })
        .collect();

    info!("Retrieved {} total blog posts", dtos.len());
    Ok(Json(dtos))
}

#[get("/api/blog/<slug>")]
pub async fn get_blog_post_by_slug(
    mut db: Connection<MessagesDB>,
    slug: String,
) -> AppResult<Json<BlogPostDto>> {
    let post: BlogPost = blog_posts::table
        .filter(blog_posts::slug.eq(&slug))
        .filter(blog_posts::published.eq(true))
        .select(BlogPost::as_select())
        .first(&mut db)
        .await
        .map_err(|e| {
            error!("Error fetching blog post by slug '{}': {}", slug, e);
            AppError::NotFound
        })?;

    let dto = BlogPostDto {
        id: post.id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content: post.content,
        image_mime: post.image_mime,
        published: post.published,
        created_at: post.created_at,
        updated_at: post.updated_at,
    };

    Ok(Json(dto))
}

#[get("/api/blog/<id>/image")]
pub async fn get_blog_post_image(
    mut db: Connection<MessagesDB>,
    id: i64,
) -> AppResult<(ContentType, Vec<u8>)> {
    let post: BlogPost = blog_posts::table.find(id).first(&mut db).await.map_err(|e| {
        error!("Error fetching blog post {} for image: {}", id, e);
        AppError::NotFound
    })?;

    if let Some(image_bytes) = post.image {
        let content_type = post
            .image_mime
            .and_then(|m| ContentType::parse_flexible(&m))
            .unwrap_or(ContentType::JPEG);

        Ok((content_type, image_bytes))
    } else {
        Err(AppError::NotFound)
    }
}
