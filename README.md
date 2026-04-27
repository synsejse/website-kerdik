# website-kerdik

Marketing website with an admin panel for contact messages, offers, blog posts, admin users, and a site-wide banner. The frontend is an Astro static site; the backend is a Rocket API backed by MariaDB and Redis.

## Features

- Public marketing site built with Astro and Tailwind CSS
- Contact form with honeypot bot detection
- Admin setup flow for the first user at `/admin/setup`
- Admin login with username + password and Redis-backed session cookies
- Offer and blog post management with image upload, resize, and JPEG re-encoding
- Banner management for the public site
- Public JSON APIs for offers, blog posts, and the active banner
- Static frontend build served by the backend at runtime

## Tech stack

- Backend: Rust, Rocket, Diesel, MariaDB, Redis
- Frontend: Astro, Tailwind CSS v4, TypeScript
- Infra: Docker Compose

## Project layout

- `backend/` - Rocket API, Diesel models, schema, and embedded migrations
- `frontend/` - Astro site and admin UI shells
- `docker-compose.yml` - MariaDB, Redis, phpMyAdmin, and app services
- `Dockerfile` - multi-stage frontend + backend build

## Quick start

1. Create a `.env` file from `.env.example`.
2. Start the stack:

```bash
docker compose up --build
```

3. Open the app:

- Site: http://localhost:8080
- phpMyAdmin: http://localhost:8081

4. Complete first-time admin setup at `http://localhost:8080/admin/setup`.

Notes:

- The backend requires both MariaDB and Redis.
- Diesel migrations run automatically on backend startup.
- Rocket serves the built Astro site from `STATIC_DIR`.

## Local verification

- Install frontend deps: `cd frontend && npm ci`
- Frontend build: `cd frontend && npm run build`
- Frontend type/content checks: `cd frontend && npm run check`
- Backend format check: `cd backend && cargo fmt --check`
- Backend compile check: `cd backend && cargo check`
- Backend tests: `cd backend && cargo test`
- Full-stack changes involving auth, DB, or runtime routing: `docker compose up --build`

## Configuration

Docker Compose reads `.env` and wires the app container like this:

- `DB_DATABASE`
- `DB_USER`
- `DB_PASSWORD`
- `DB_ROOT_PASSWORD`
- `REDIS_URL` (defaults to `redis://redis:6379`)
- `ROCKET_ADDRESS` (defaults to `0.0.0.0`)
- `ROCKET_PORT` (defaults to `8080`)
- `STATIC_DIR` (defaults to `/app/static`)

For local backend runs outside Docker, the backend expects:

- `DATABASE_URL`
- `REDIS_URL`

It can also load config from `Config.toml` in either the repo root or `backend/`.

## Runtime architecture

- Astro is built as a static site (`frontend/astro.config.mjs` uses `output: 'static'`).
- Rocket owns the real runtime routing and serves the built files.
- `/offer/<slug>` is served by Rocket as `offer-detail/index.html`.
- `/blog/<slug>` is served by Rocket as `blog/post/index.html`.
- Those detail pages resolve the slug client-side from `window.location.pathname` and then fetch JSON from the backend.
- Running the frontend alone only gives you the static shells; admin and data-driven pages rely on same-origin backend APIs.

## API overview

All endpoints are served by the Rocket backend.

### Public endpoints

- `POST /contact/message` - submit contact form fields `name`, `email`, `message`; optional `phone`, `subject`; `company` is a honeypot field
- `GET /api/offers` - list offers
- `GET /api/offers/:slug` - get a single offer by slug
- `GET /api/offers/:id/image` - get offer image bytes
- `GET /api/blog` - list published blog posts
- `GET /api/blog/:slug` - get a single published blog post by slug
- `GET /api/blog/:id/image` - get blog post image bytes
- `GET /api/banner` - get the active banner, or `null`

### Admin auth and setup

- `POST /admin/setup` - create the first admin user with JSON `{ "username": "...", "password": "..." }`
- `POST /admin/login` - sign in with JSON `{ "username": "...", "password": "..." }`
- `POST /admin/logout` - clear the session
- `GET /admin/status` - auth + setup status `{ authenticated, setup_required, current_user_id, current_username }`

Admin sessions are stored in Redis and identified by the `admin_auth` cookie.

### Admin messages

- `GET /admin/api/messages?page=&limit=` - paginated active messages
- `POST /admin/api/messages/:id/archive` - JSON `{ "action": "archive" | "restore" }`
- `DELETE /admin/api/messages/:id` - archives the message
- `GET /admin/api/archived/messages?page=&limit=` - paginated archived messages
- `DELETE /admin/api/archived/messages/:id` - permanently delete an archived message

### Admin offers

- `POST /admin/api/offers` - multipart form with `title`, `slug`, optional `excerpt`, `content`, `link`, `latitude`, `longitude`, and optional `image`
- `PUT /admin/api/offers/:id` - same fields as create; image optional
- `DELETE /admin/api/offers/:id` - hard delete

### Admin blog

- `POST /admin/api/blog` - multipart form with `title`, `slug`, `content`, optional `excerpt`, optional `published`, and optional `image`
- `PUT /admin/api/blog/:id` - same fields as create; image optional
- `DELETE /admin/api/blog/:id` - hard delete
- `GET /admin/api/blog` - list all posts, including drafts

### Admin users and invites

- `GET /admin/api/users` - list admin users
- `POST /admin/api/users` - create an admin user with JSON `{ "username": "...", "password": "..." }`
- `PUT /admin/api/users/:id` - update username and optionally password with JSON `{ "username": "...", "password": "..." | null }`
- `DELETE /admin/api/users/:id` - delete an admin user, except the current user or the last remaining user
- `GET /admin/api/users/invites` - list active invites
- `POST /admin/api/users/invites` - create invite with JSON `{ "username": "..." }`
- `DELETE /admin/api/users/invites/:id` - delete invite
- `GET /admin/invite/status?token=...` - validate invite token
- `POST /admin/invite/accept` - accept invite with JSON `{ "token": "...", "password": "..." }`

### Admin banner

- `GET /admin/api/banner` - get the current banner row, active or not
- `PUT /admin/api/banner` - create or update banner with JSON `{ title, message, tone, link_label, link_url, is_active }`
- `DELETE /admin/api/banner` - delete the current banner row

## Database notes

- Migrations live in `backend/migrations/` and are embedded into the backend binary.
- If you change the schema, update both the Diesel migration files and `backend/src/schema.rs`.
- Current main tables are:
  - `messages`
  - `messages_archive`
  - `offers`
  - `blog_posts`
  - `admin_users`
  - `admin_user_invites`
  - `banners`

## Image handling

Uploaded offer and blog images are validated server-side, resized to a maximum dimension of 1920px, and always re-encoded as JPEG.

## License

MIT
