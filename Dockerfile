# syntax=docker/dockerfile:1.7
###############################################
# Stage 1: Build the frontend with Node
###############################################
FROM node:25-bookworm-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY frontend/ ./
RUN npm run build

##############################################
# Stage 2: Build the Rust backend (with cargo-chef caching)
##############################################
FROM rust:1.93-slim-trixie AS backend-common
WORKDIR /app/backend
RUN cargo install cargo-chef
RUN apt-get update && \
    apt-get install -y libssl-dev pkg-config ca-certificates default-libmysqlclient-dev && \
    rm -rf /var/lib/apt/lists/*

FROM backend-common AS backend-planner
COPY backend/ ./
RUN cargo chef prepare --recipe-path recipe.json

FROM backend-common AS backend-cacher
COPY --from=backend-planner /app/backend/recipe.json recipe.json
RUN --mount=type=cache,id=cargo-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=cargo-target,target=/app/backend/target \
    cargo chef cook --release --recipe-path recipe.json

FROM backend-common AS backend-builder
COPY backend/ ./
RUN --mount=type=cache,id=cargo-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=cargo-target,target=/app/backend/target \
    cargo build --release \
    && mkdir -p /out \
    && cp target/release/backend /out/backend

##############################################
# Stage 3: Runtime image
##############################################
FROM debian:trixie-slim AS runtime
RUN apt-get update && \
    apt-get install -y default-libmysqlclient-dev ca-certificates && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=backend-builder /out/backend /app/backend
COPY --from=frontend-builder /app/frontend/dist /app/static
ENV ROCKET_ADDRESS=0.0.0.0
ENV ROCKET_PORT=8080
ENV STATIC_DIR=/app/static
EXPOSE 8080
CMD ["/app/backend"]
