// Utility functions for common operations

use rocket::fs::TempFile;
use rocket::tokio::io::AsyncReadExt;

use crate::error::{AppError, AppResult};

/// Validate and process an uploaded image file
pub async fn process_image_upload<'r>(
    temp_file: Option<TempFile<'r>>,
) -> AppResult<Option<(Vec<u8>, String)>> {
    let temp_file = match temp_file {
        Some(file) => file,
        None => return Ok(None),
    };

    // Validate content type is an image we accept
    let content_type = temp_file
        .content_type()
        .filter(|ct: &&rocket::http::ContentType| ct.is_jpeg() || ct.is_png() || ct.is_gif())
        .ok_or(AppError::UnsupportedMediaType)?;

    let mut buffer = Vec::new();
    let mut file = temp_file.open().await.map_err(|e| {
        tracing::error!("Failed to open uploaded file: {}", e);
        AppError::Io(e)
    })?;

    file.read_to_end(&mut buffer).await.map_err(|e| {
        tracing::error!("Failed to read uploaded file: {}", e);
        AppError::Io(e)
    })?;

    Ok(Some((buffer, content_type.to_string())))
}

/// Validate an email address format
pub fn validate_email(email: &str) -> bool {
    email.contains('@')
        && email.trim().len() >= 5
        && !email.trim().is_empty()
        && email.split('@').count() == 2
        && !email.starts_with('@')
        && !email.ends_with('@')
}

/// Validate that a string is not empty after trimming
pub fn validate_not_empty(s: &str) -> bool {
    !s.trim().is_empty()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_email() {
        assert!(validate_email("test@example.com"));
        assert!(validate_email("user+tag@example.co.uk"));
        assert!(!validate_email("invalid"));
        assert!(!validate_email("@example.com"));
        assert!(!validate_email("user@"));
        assert!(!validate_email("user@@example.com"));
        assert!(!validate_email(""));
        assert!(!validate_email("   "));
    }

    #[test]
    fn test_validate_not_empty() {
        assert!(validate_not_empty("hello"));
        assert!(validate_not_empty("  hello  "));
        assert!(!validate_not_empty(""));
        assert!(!validate_not_empty("   "));
        assert!(!validate_not_empty("\t\n"));
    }
}
