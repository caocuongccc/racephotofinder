import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadToCloudinary(
  buffer: Buffer,
  folder: string,
  filename: string,
): Promise<{ publicId: string; url: string; thumbnailUrl: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: filename,
        resource_type: "image",
        eager: [
          { width: 400, crop: "limit" }, // Thumbnail
        ],
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            publicId: result!.public_id,
            url: result!.secure_url,
            thumbnailUrl: result!.eager[0].secure_url,
          });
        }
      },
    );

    uploadStream.end(buffer);
  });
}

export async function deleteFromCloudinary(publicId: string) {
  await cloudinary.uploader.destroy(publicId);
}
