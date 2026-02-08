// Utility functions for common operations

use rocket::tokio::io::AsyncReadExt;
use rocket::{fs::TempFile, http::ContentType};
use image::{GenericImageView, ImageFormat, ImageReader, imageops::FilterType};
use std::io::Cursor;

use crate::error::{AppError, AppResult};

/// Maximum dimension (width or height) for uploaded images
const MAX_IMAGE_DIMENSION: u32 = 1920;
/// JPEG quality for compression (0-100)
const JPEG_QUALITY: u8 = 85;

/// Validate and process an uploaded image file with compression and resizing
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

    // Validate against allowed list
    let final_ct = content_type
        .filter(|ct| ct.is_jpeg() || ct.is_png() || ct.is_gif())
        .ok_or(AppError::UnsupportedMediaType)?;

    // Read the file into a buffer
    let mut buffer = Vec::new();
    let mut file = temp_file.open().await.map_err(|e| {
        tracing::error!("Failed to open uploaded file: {}", e);
        AppError::Io(e)
    })?;

    file.read_to_end(&mut buffer).await.map_err(|e| {
        tracing::error!("Failed to read uploaded file: {}", e);
        AppError::Io(e)
    })?;

    // Process and compress the image
    let (compressed_buffer, mime_type) = compress_image(buffer, &final_ct)?;

    tracing::info!(
        "Image processed: original type={}, final type={}, size={} bytes",
        final_ct,
        mime_type,
        compressed_buffer.len()
    );

    Ok(Some((compressed_buffer, mime_type)))
}

/// Compress and resize an image if necessary
fn compress_image(buffer: Vec<u8>, content_type: &ContentType) -> AppResult<(Vec<u8>, String)> {
    // Load the image
    let img = ImageReader::new(Cursor::new(&buffer))
        .with_guessed_format()
        .map_err(|e| {
            tracing::error!("Failed to guess image format: {}", e);
            AppError::InvalidInput("Invalid image format".to_string())
        })?
        .decode()
        .map_err(|e| {
            tracing::error!("Failed to decode image: {}", e);
            AppError::InvalidInput("Failed to decode image".to_string())
        })?;

    let (width, height) = img.dimensions();
    tracing::debug!("Original image dimensions: {}x{}", width, height);

    // Resize if image is too large
    let img = if width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION {
        let (new_width, new_height) = if width > height {
            let ratio = height as f32 / width as f32;
            (MAX_IMAGE_DIMENSION, (MAX_IMAGE_DIMENSION as f32 * ratio) as u32)
        } else {
            let ratio = width as f32 / height as f32;
            ((MAX_IMAGE_DIMENSION as f32 * ratio) as u32, MAX_IMAGE_DIMENSION)
        };

        tracing::info!("Resizing image from {}x{} to {}x{}", width, height, new_width, new_height);
        img.resize(new_width, new_height, FilterType::Lanczos3)
    } else {
        img
    };

    // Convert to RGB/RGBA for encoding
    let output_format = if content_type.is_png() {
        ImageFormat::Png
    } else {
        // Convert GIF and JPEG to JPEG for better compression
        ImageFormat::Jpeg
    };

    let mut output_buffer = Vec::new();
    let mut cursor = Cursor::new(&mut output_buffer);

    match output_format {
        ImageFormat::Jpeg => {
            let rgb_img = image::DynamicImage::ImageRgb8(img.to_rgb8());
            let encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, JPEG_QUALITY);
            rgb_img.write_with_encoder(encoder).map_err(|e| {
                tracing::error!("Failed to encode JPEG: {}", e);
                AppError::InvalidInput("Failed to encode image".to_string())
            })?;
        }
        ImageFormat::Png => {
            img.write_to(&mut cursor, ImageFormat::Png).map_err(|e| {
                tracing::error!("Failed to encode PNG: {}", e);
                AppError::InvalidInput("Failed to encode image".to_string())
            })?;
        }
        _ => {
            return Err(AppError::UnsupportedMediaType);
        }
    }

    let mime_type = match output_format {
        ImageFormat::Jpeg => "image/jpeg",
        ImageFormat::Png => "image/png",
        _ => "application/octet-stream",
    };

    Ok((output_buffer, mime_type.to_string()))
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
