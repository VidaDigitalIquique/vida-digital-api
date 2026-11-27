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

/** Listado de solo lectura de las imágenes de productos (Admin API), una página por llamada. */
export async function listarImagenesProductos(
  cursor: string | null = null,
  max = 500
): Promise<{
  recursos: { public_id: string; secure_url: string; created_at: string | null }[];
  siguiente: string | null;
}> {
  const cld = getCloudinary();
  type RecursoAdmin = { public_id: string; secure_url: string; created_at?: string };
  const res = (await cld.api.resources({
    type: 'upload',
    prefix: 'productos/',
    max_results: max,
    next_cursor: cursor ?? undefined,
  })) as { resources?: RecursoAdmin[]; next_cursor?: string };
  return {
    recursos: (res?.resources ?? []).map((r) => ({
      public_id: r.public_id,
      secure_url: r.secure_url,
      created_at: r.created_at ?? null,
    })),
    siguiente: res?.next_cursor ?? null,
  };
}
