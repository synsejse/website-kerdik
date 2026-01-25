// Error types and conversions for the application

use rocket::http::Status;
use rocket::response::{self, Responder};
use rocket::{Request, Response};
use std::io::Cursor;
use thiserror::Error;

/// Main application error type
#[derive(Error, Debug)]
pub enum AppError {
    #[error("Database error: {0}")]
    Database(#[from] diesel::result::Error),

    #[error("Database pool error: {0}")]
    DatabasePool(#[from] rocket::tokio::task::JoinError),

    #[error("Invalid input: {0}")]
    InvalidInput(String),

    #[error("Unauthorized")]
    Unauthorized,

    #[error("Resource not found")]
    NotFound,

    #[error("Unsupported media type")]
    UnsupportedMediaType,

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

impl AppError {
    /// Get the HTTP status code for this error
    pub fn status(&self) -> Status {
        match self {
            AppError::Database(_) => Status::InternalServerError,
            AppError::DatabasePool(_) => Status::InternalServerError,
            AppError::InvalidInput(_) => Status::BadRequest,
            AppError::Unauthorized => Status::Unauthorized,
            AppError::NotFound => Status::NotFound,
            AppError::UnsupportedMediaType => Status::UnsupportedMediaType,
            AppError::Io(_) => Status::InternalServerError,
        }
    }

    /// Check if this error should be logged as an error
    pub fn should_log_as_error(&self) -> bool {
        matches!(
            self,
            AppError::Database(_) | AppError::DatabasePool(_) | AppError::Io(_)
        )
    }
}

impl<'r> Responder<'r, 'r> for AppError {
    fn respond_to(self, _: &'r Request<'_>) -> response::Result<'r> {
        let status = self.status();
        let message = self.to_string();

        // Log error if it's a server error
        if self.should_log_as_error() {
            tracing::error!("Application error: {}", message);
        } else {
            tracing::debug!("Client error: {}", message);
        }

        Response::build()
            .status(status)
            .sized_body(message.len(), Cursor::new(message))
            .ok()
    }
}

/// Result type alias for the application
pub type AppResult<T> = Result<T, AppError>;

impl From<bcrypt::BcryptError> for AppError {
    fn from(_: bcrypt::BcryptError) -> Self {
        AppError::Unauthorized
    }
}
