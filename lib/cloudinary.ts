import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

function getCloudinary() {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return cloudinary;
}

export default cloudinary;

export async function uploadImage(base64Data: string, folder: string, publicId?: string): Promise<UploadApiResponse> {
  const cld = getCloudinary();
  return new Promise((resolve, reject) => {
    cld.uploader.upload(
      base64Data,
      { folder, public_id: publicId, overwrite: true, transformation: [{ quality: "auto", width: 1200, crop: "limit" }] },
      (error, result) => {
        if (error) reject(error);
        else resolve(result as UploadApiResponse);
      }
    );
  });
}

export async function deleteImage(publicId: string) {
  return getCloudinary().uploader.destroy(publicId);
}
