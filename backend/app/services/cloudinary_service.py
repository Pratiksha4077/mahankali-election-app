import logging
from pathlib import Path
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
    def ping() -> bool:
        if not CloudinaryService.is_configured():
            return False
        try:
            res = cloudinary.api.ping()
            return res.get("status") == "ok"
        except Exception as e:
            logger.warning("Cloudinary ping failed: %s", e)
            return False

    @staticmethod
    def upload_file(
        file_path: str,
        original_filename: Optional[str] = None,
        folder: str = "election_app/voter_lists",
        resource_type: str = "auto"
    ) -> Optional[Dict[str, Any]]:
        """
        Uploads a file to Cloudinary preserving the EXACT original filename.
        Excel (.xlsx, .xls) and CSV (.csv) files are automatically routed to 'raw' resource_type.
        """
        if not CloudinaryService.is_configured():
            logger.warning("Cannot upload to Cloudinary: credentials not set")
            return None

        p = Path(file_path)
        actual_name = original_filename or p.name
        ext = p.suffix.lower()

        # Determine correct resource_type for Cloudinary
        res_type = resource_type
        if res_type == "auto":
            if ext in [".xlsx", ".xls", ".csv", ".txt", ".json", ".pdf"]:
                res_type = "raw"
            else:
                res_type = "auto"

        # Construct public_id that keeps the original filename
        target_public_id = f"{folder}/{actual_name}" if folder else actual_name

        try:
            res = cloudinary.uploader.upload(
                str(file_path),
                public_id=target_public_id,
                resource_type=res_type,
                use_filename=True,
                unique_filename=False,
                filename_override=actual_name,
                overwrite=True
            )
            logger.info("Cloudinary upload success: %s -> %s", actual_name, res.get("secure_url"))
            return {
                "secure_url": res.get("secure_url"),
                "public_id": res.get("public_id"),
                "original_filename": actual_name,
                "format": res.get("format") or ext.replace(".", ""),
                "bytes": res.get("bytes"),
                "resource_type": res.get("resource_type") or res_type
            }
        except Exception as e:
            logger.error("Cloudinary upload failed for %s: %s", actual_name, e)
            return None

    @staticmethod
    def delete_file(public_id: str, resource_type: str = "raw") -> bool:
        """
        Deletes a file from Cloudinary by its public_id.
        Safely attempts 'raw' and 'image' resource types to ensure clean deletion.
        """
        if not CloudinaryService.is_configured() or not public_id:
            return False

        # 1. Try specified resource type first
        try:
            res = cloudinary.uploader.destroy(public_id, resource_type=resource_type)
            if res.get("result") == "ok":
                logger.info("Cloudinary deleted (%s): %s", resource_type, public_id)
                return True
        except Exception as e:
            logger.warning("Cloudinary delete attempt 1 (%s) failed for %s: %s", resource_type, public_id, e)

        # 2. Try alternate resource type if first was not ok
        alt_type = "image" if resource_type == "raw" else "raw"
        try:
            res_alt = cloudinary.uploader.destroy(public_id, resource_type=alt_type)
            if res_alt.get("result") == "ok":
                logger.info("Cloudinary deleted (%s): %s", alt_type, public_id)
                return True
        except Exception as e2:
            logger.warning("Cloudinary delete attempt 2 (%s) failed for %s: %s", alt_type, public_id, e2)

        return False
