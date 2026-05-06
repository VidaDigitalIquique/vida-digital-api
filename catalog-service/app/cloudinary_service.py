import os
import base64
import cloudinary
import cloudinary.uploader


def upload_image(jpeg_bytes: bytes, product_code: str) -> str:
    cloudinary.config(
        cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
        api_key=os.environ["CLOUDINARY_API_KEY"],
        api_secret=os.environ["CLOUDINARY_API_SECRET"],
    )
    b64 = "data:image/jpeg;base64," + base64.b64encode(jpeg_bytes).decode()
    result = cloudinary.uploader.upload(
        b64,
        folder="productos",
        public_id=product_code,
        overwrite=True,
    )
    return result["secure_url"]
