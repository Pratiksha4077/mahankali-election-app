import logging
from typing import Optional, Dict, Any
import cloudinary
import cloudinary.uploader
import cloudinary.api
from app.config.config import settings

logger = logging.getLogger("election_app.cloudinary")

# Configure Cloudinary
if settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET:
    cloudinary.config(
        cloud_name=settings.CLOUDINARY_CLOUD_NAME,
        api_key=settings.CLOUDINARY_API_KEY,
        api_secret=settings.CLOUDINARY_API_SECRET,
        secure=True
    )
    logger.info("Cloudinary configured successfully for cloud: %s", settings.CLOUDINARY_CLOUD_NAME)
else:
    logger.warning("Cloudinary credentials missing in environment.")

class CloudinaryService:
    @staticmethod
    def is_configured() -> bool:
        return bool(settings.CLOUDINARY_CLOUD_NAME and settings.CLOUDINARY_API_KEY and settings.CLOUDINARY_API_SECRET)

    @staticmethod
    def upload_file(file_path: str, folder: str = "election_app", resource_type: str = "auto") -> Optional[Dict[str, Any]]:
        """
        Upload a file (image, PDF, Excel, document) to Cloudinary.
        Returns a dict with secure_url, public_id, format, etc.
        """
        if not CloudinaryService.is_configured():
            logger.warning("Cannot upload to Cloudinary: credentials not set")
            return None

        try:
            res = cloudinary.uploader.upload(
                file_path,
                folder=folder,
                resource_type=resource_type,
                use_filename=True,
                unique_filename=True
            )
            return {
                "secure_url": res.get("secure_url"),
                "public_id": res.get("public_id"),
                "format": res.get("format"),
                "bytes": res.get("bytes"),
                "resource_type": res.get("resource_type")
            }
        except Exception as e:
            logger.error("Cloudinary upload failed for %s: %s", file_path, e)
            return None

    @staticmethod
    def delete_file(public_id: str, resource_type: str = "image") -> bool:
        """Delete a file from Cloudinary by its public_id."""
        if not CloudinaryService.is_configured():
            return False
        try:
            res = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
            return res.get("result") == "ok"
        except Exception as e:
            logger.error("Cloudinary deletion failed for %s: %s", public_id, e)
            return False
