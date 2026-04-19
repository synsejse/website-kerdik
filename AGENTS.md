# AGENTS.md

## Repo Shape
- `frontend/` is an Astro site with `output: "static"`; `backend/` is the Rocket app that mounts the API and serves the built frontend from `STATIC_DIR`.
- `bcrypt-gen/` is only for generating `ADMIN_PASSWORD_HASH`: `cargo run --manifest-path bcrypt-gen/Cargo.toml -- "your-password"`.

## Commands
- Full stack: `docker compose up --build`
- Frontend (`frontend/`): `npm install`, `npm exec astro check`, `npm run build`
- Backend (`backend/`): `cargo check`
- Local end-to-end run order: build `frontend/dist` first, then run the backend with `STATIC_DIR=../frontend/dist DATABASE_URL=... ADMIN_PASSWORD_HASH=... cargo run`

## Gotchas
- Use `npm` for agent work here. `frontend/` has both `bun.lock` and `package-lock.json`, but the Docker build uses `package-lock.json` and runs `npm install`.
- `.env` is a Docker Compose input, not a local Rust dev env loader. `backend/src/config.rs` only reads process env vars or `Config.toml` / `../Config.toml`.
- Backend startup runs embedded Diesel migrations automatically; it will fail fast if MariaDB is unavailable or `DATABASE_URL` is wrong.
- If `ADMIN_PASSWORD_HASH` is empty, the backend still starts but admin login is effectively disabled.
- Browser API calls use same-origin URLs (`frontend/src/lib/api-client.ts`). `astro dev` alone will send admin/public API requests to the Astro dev server, not Rocket, unless you add a proxy.
- No repo CI, task runner, lint config, or pre-commit config was found at the root; use the package-native commands above instead of guessing wrapper commands.

## Code Map
- `backend/src/main.rs`: app wiring, DB init, migration hook, route mounts, static file serving.
- `backend/src/routes/admin/`: admin APIs for messages, offers, and blog.
- `frontend/src/pages/admin/*.astro` plus `frontend/src/lib/admin/*`: admin UI shells plus client-side behavior.
- `frontend/src/lib/api.ts`: typed API surface used by the frontend.
