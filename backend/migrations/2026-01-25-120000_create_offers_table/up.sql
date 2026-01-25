CREATE TABLE offers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT NULL,
    link TEXT NULL,
    image LONGBLOB NULL,
    image_mime VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes for quicker lookups
CREATE UNIQUE INDEX idx_offers_slug ON offers (slug(255));
CREATE INDEX idx_offers_created_at ON offers (created_at);
CREATE INDEX idx_offers_link ON offers (link(255));
