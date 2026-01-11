CREATE TABLE admin_sessions (
    ip_address VARCHAR(45) NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    session_token VARCHAR(36) PRIMARY KEY
);