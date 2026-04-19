CREATE TABLE admin_user_invites (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(191) NOT NULL,
    token VARCHAR(64) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT NULL,
    UNIQUE KEY idx_admin_user_invites_token (token),
    UNIQUE KEY idx_admin_user_invites_username (username),
    CONSTRAINT fk_admin_user_invites_created_by
        FOREIGN KEY (created_by) REFERENCES admin_users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
