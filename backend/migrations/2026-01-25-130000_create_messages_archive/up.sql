-- Create messages_archive table to store archived messages (without archived_by)
CREATE TABLE messages_archive (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    original_id BIGINT NOT NULL COMMENT 'Original message ID before archiving',
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    subject TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL COMMENT 'Original creation date',
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When message was archived'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Indexes for better query performance
CREATE INDEX idx_email ON messages_archive(email(255));
CREATE INDEX idx_created_at ON messages_archive(created_at);
CREATE INDEX idx_archived_at ON messages_archive(archived_at);
CREATE INDEX idx_original_id ON messages_archive(original_id);
