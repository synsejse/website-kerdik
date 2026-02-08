CREATE TABLE blog_posts (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    excerpt TEXT NULL,
    content TEXT NOT NULL,
    image LONGBLOB NULL,
    image_mime VARCHAR(255) NULL,
    published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes for quicker lookups
CREATE UNIQUE INDEX idx_blog_posts_slug ON blog_posts (slug(255));
CREATE INDEX idx_blog_posts_published ON blog_posts (published);
CREATE INDEX idx_blog_posts_created_at ON blog_posts (created_at);
