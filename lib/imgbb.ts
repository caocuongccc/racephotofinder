/**
 * Imgbb.com - Free Unlimited Image Hosting
 * Get API key: https://api.imgbb.com/
 */

interface ImgbbUploadResponse {
  data: {
    id: string;
    url: string;
    display_url: string;
    thumb: {
      url: string;
    };
    medium: {
      url: string;
    };
    image: {
      url: string;
    };
    delete_url: string;
  };
  success: boolean;
  status: number;
}

/**
 * Upload image to Imgbb
 */
export async function uploadToImgbb(
  buffer: Buffer,
  fileName: string
): Promise<{
  id: string;
  url: string;
  thumbnailUrl: string;
  deleteUrl: string;
}> {
  try {
    const apiKey = process.env.IMGBB_API_KEY;
    console.log("📤 apiKeyapiKey:", apiKey);
    if (!apiKey) {
      throw new Error("IMGBB_API_KEY is not set in environment variables");
    }

    console.log("📤 Uploading to Imgbb:", fileName);

    // Convert buffer to base64
    const base64Image = buffer.toString("base64");

    // Create FormData
    const formData = new FormData();
    formData.append("image", base64Image);
    formData.append("name", fileName);

    // Upload to Imgbb
    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${apiKey}`,
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ Imgbb error response:", errorText);
      throw new Error(`Imgbb upload failed: ${response.status} - ${errorText}`);
    }

    const data: ImgbbUploadResponse = await response.json();

    if (!data.success) {
      throw new Error("Imgbb upload unsuccessful");
    }

    console.log("✅ Uploaded to Imgbb:", {
      id: data.data.id,
      url: data.data.display_url,
    });

    return {
      id: data.data.id,
      url: data.data.display_url, // URL gốc (full size)
      thumbnailUrl: data.data.thumb.url, // Thumbnail URL (auto-generated)
      deleteUrl: data.data.delete_url, // URL để xóa
    };
  } catch (error: any) {
    console.error("❌ Imgbb upload error:", error.message);
    throw error;
  }
}

/**
 * Delete image from Imgbb
 */
export async function deleteFromImgbb(deleteUrl: string): Promise<void> {
  try {
    await fetch(deleteUrl);
    console.log("🗑️ Deleted from Imgbb");
  } catch (error) {
    console.error("❌ Imgbb delete error:", error);
  }
}

/**
 * Generate unique filename
 */
export function generateImgbbFileName(
  eventId: string,
  originalName: string,
  type: "original" | "thumbnail" = "original"
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const ext = originalName.split(".").pop() || "jpg";

  const prefix = type === "thumbnail" ? "thumb" : "photo";
  return `${prefix}-${eventId.substring(0, 8)}-${timestamp}-${random}.${ext}`;
}
