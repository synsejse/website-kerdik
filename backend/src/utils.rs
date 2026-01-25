// Utility functions for common operations

use rocket::tokio::io::AsyncReadExt;
use rocket::{fs::TempFile, http::ContentType};

use crate::error::{AppError, AppResult};

/// Validate and process an uploaded image file
pub async fn process_image_upload<'r>(
    temp_file: Option<TempFile<'r>>,
) -> AppResult<Option<(Vec<u8>, String)>> {
    let temp_file = match temp_file {
        Some(file) => file,
        None => return Ok(None),
    };

    let content_type = temp_file.content_type().cloned().or_else(|| {
        temp_file
            .name()
            .and_then(|n| n.split('.').next_back()) // Get extension
            .and_then(ContentType::from_extension)
    });

    // Now validate against your allowed list
    let final_ct = content_type
        .filter(|ct| ct.is_jpeg() || ct.is_png() || ct.is_gif())
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

    // Return the normalized content type string (e.g., "image/jpeg")
    Ok(Some((buffer, final_ct.to_string())))
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
