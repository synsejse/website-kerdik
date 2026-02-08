# website-kerdik

Marketing website with an admin panel for contact messages, offers, and blog posts.
The frontend is an Astro static site, and the backend is a Rocket (Rust) API with
MariaDB and embedded Diesel migrations. Docker builds and serves both parts.

## Features

- Contact form with honeypot bot detection
- Admin auth with bcrypt password hash + session cookies
- Offers and blog posts with image upload and compression
- Public JSON APIs for offers and blog posts
- Static site build served by the backend

## Tech stack

- Backend: Rust, Rocket, Diesel, MariaDB
- Frontend: Astro, Tailwind CSS, TypeScript
- Infra: Docker or Podman, docker-compose

## Project layout

- backend/ - Rocket API + Diesel models/migrations
- frontend/ - Astro static site
- bcrypt-gen/ - CLI to generate `ADMIN_PASSWORD_HASH`
- docker-compose.yml - MariaDB, phpMyAdmin, app container
- Dockerfile - multi-stage build (frontend + backend)

## Quick start (Docker)

1) Create a `.env` file based on `.env.example`.
2) Generate the admin password hash (optional but recommended):

```bash
cargo run --manifest-path bcrypt-gen/Cargo.toml -- "your-admin-password"
```

3) Start the stack:

```bash
docker compose up --build
```

4) Open the app:

- Site: http://localhost:8080
- phpMyAdmin: http://localhost:8081

Notes:
- Migrations run automatically on app startup.
- The backend serves the Astro build from `/app/static`.

## Environment variables

Configured via `.env` (Docker) or your shell (local dev).

- `DB_DATABASE` - MariaDB database name
- `DB_USER` - MariaDB user
- `DB_PASSWORD` - MariaDB user password
- `DB_ROOT_PASSWORD` - MariaDB root password
- `DATABASE_URL` - Full MariaDB URL (non-Docker usage)
- `ADMIN_PASSWORD_HASH` - bcrypt hash for admin login
- `ROCKET_ADDRESS` - bind address (default 0.0.0.0)
- `ROCKET_PORT` - port (default 8080)
- `STATIC_DIR` - static files directory (default /app/static)

## API overview

All endpoints are served by the Rocket backend. Admin endpoints require a
valid `admin_auth` cookie (created by login). Pagination defaults to page=1,
limit=10 unless specified.

### Public endpoints

- `POST /contact/message` - Submit a contact form (multipart/form or form-url-encoded).
	Required fields: `name`, `email`, `message`. Optional: `phone`, `subject`.
	The `company` field is a honeypot; if set, the submission is rejected.
- `GET /api/offers` - List offers (JSON array).
- `GET /api/offers/:id/image` - Offer image bytes; content-type reflects stored mime.
- `GET /api/blog` - List published blog posts.
- `GET /api/blog/:slug` - Get a single published post by slug.
- `GET /api/blog/:id/image` - Blog image bytes; content-type reflects stored mime.

### Admin auth

- `POST /admin/login` - JSON body: `{ "password": "..." }`. Sets `admin_auth` cookie.
- `POST /admin/logout` - Clears cookie and deletes session server-side.
- `GET /admin/check` - Returns `true` when authenticated.

### Admin: messages

- `GET /admin/api/messages?page=&limit=` - Paginated list of active messages.
- `POST /admin/api/messages/:id/archive` - JSON body: `{ "action": "archive" | "restore" }`.
- `DELETE /admin/api/messages/:id` - Archives the message (soft delete).
- `GET /admin/api/archived/messages?page=&limit=` - Paginated list of archived messages.
- `DELETE /admin/api/archived/messages/:id` - Permanent delete from archive.

### Admin: offers

- `POST /admin/api/offers` - Multipart form. Fields: `title`, `slug`, optional
	`description`, `link`, `latitude`, `longitude`, and `image` file.
- `PUT /admin/api/offers/:id` - Multipart form. Same fields as create; image optional.
- `DELETE /admin/api/offers/:id` - Hard delete.

### Admin: blog posts

- `POST /admin/api/blog` - Multipart form. Fields: `title`, `slug`, `content`,
	optional `excerpt`, `published` (bool), and `image` file.
- `PUT /admin/api/blog/:id` - Multipart form. Same fields as create; image optional.
- `DELETE /admin/api/blog/:id` - Hard delete.
- `GET /admin/api/blog` - List all posts (published and drafts).

## Database structure

The database uses MariaDB with Diesel migrations embedded in the backend.
Tables are normalized and designed for simple admin workflows.

### `messages`

- Contact messages from the public form.
- Key fields: `id`, `name`, `email`, `phone`, `subject`, `message`, `created_at`.

### `messages_archive`

- Archived contact messages (soft-delete history).
- Key fields: `id`, `original_id`, `name`, `email`, `phone`, `subject`,
	`message`, `created_at`, `archived_at`.
- Restore flow uses `original_id` to reinsert into `messages`.

### `admin_sessions`

- Session tokens for admin login with optional IP binding.
- Key fields: `session_token`, `created_at`, `expires_at`, `ip_address`.

### `offers`

- Public offer listings with optional map coordinates.
- Key fields: `id`, `title`, `slug`, `description`, `link`, `image`,
	`image_mime`, `created_at`, `latitude`, `longitude`.

### `blog_posts`

- Blog content and publication status.
- Key fields: `id`, `title`, `slug`, `excerpt`, `content`, `image`,
	`image_mime`, `published`, `created_at`, `updated_at`.

## Image handling

Uploaded images are validated, resized to a max 1920px edge, and compressed.
All images are re-encoded as JPEG for consistent storage and size.

## License

MIT
