import { google } from "googleapis";
import { Readable } from "stream";

// Initialize Google Drive API
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});

const drive = google.drive({ version: "v3", auth });

const PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || "root"; // Use 'root' if no folder specified

/**
 * Create folder in Google Drive (nếu chưa tồn tại)
 */
async function getOrCreateFolder(
  folderName: string,
  parentId: string = PARENT_FOLDER_ID
): Promise<string> {
  try {
    // Check if folder exists
    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
      fields: "files(id, name)",
    });

    if (response.data.files && response.data.files.length > 0) {
      return response.data.files[0].id!;
    }

    // Create folder if not exists
    const folderMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    };

    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: "id",
    });

    return folder.data.id!;
  } catch (error) {
    console.error("Error creating folder:", error);
    throw error;
  }
}

/**
 * Upload file to Google Drive
 */
export async function uploadToGoogleDrive(
  fileName: string,
  buffer: Buffer,
  mimeType: string,
  folderPath: string[] = [] // ['events', 'event-id', 'photos']
): Promise<{ fileId: string; webViewLink: string; webContentLink: string }> {
  try {
    // Validate parent folder exists
    if (!PARENT_FOLDER_ID) {
      throw new Error(
        "GOOGLE_DRIVE_FOLDER_ID is not set in environment variables"
      );
    }

    // Create nested folders
    let currentParentId = PARENT_FOLDER_ID;
    for (const folderName of folderPath) {
      currentParentId = await getOrCreateFolder(folderName, currentParentId);
    }

    console.log("📁 Uploading to folder:", currentParentId);

    // Convert buffer to readable stream
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);

    const fileMetadata = {
      name: fileName,
      parents: [currentParentId],
    };

    const media = {
      mimeType,
      body: readable,
    };

    console.log("📤 Starting upload to Google Drive...");

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, webViewLink, webContentLink",
    });

    console.log("✅ File created:", response.data.id);

    // Make file publicly accessible (anyone with link can view)
    try {
      await drive.permissions.create({
        fileId: response.data.id!,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });
      console.log("✅ Permissions set to public");
    } catch (permError) {
      console.warn("⚠️ Could not set public permissions:", permError);
      // Continue even if permissions fail
    }

    return {
      fileId: response.data.id!,
      webViewLink: response.data.webViewLink!,
      webContentLink: response.data.webContentLink!,
    };
  } catch (error: any) {
    console.error("❌ Error uploading to Google Drive:", error);

    // Provide more helpful error messages
    if (error.message?.includes("Service Accounts do not have storage quota")) {
      throw new Error(
        "Service Account needs access to a shared folder. " +
          "Please share the folder (ID: " +
          PARENT_FOLDER_ID +
          ") with the service account email."
      );
    }

    throw error;
  }
}

/**
 * Get download link for file
 */
export async function getDownloadLink(fileId: string): Promise<string> {
  try {
    const response = await drive.files.get({
      fileId,
      fields: "webContentLink",
    });

    return response.data.webContentLink || "";
  } catch (error) {
    console.error("Error getting download link:", error);
    throw error;
  }
}

/**
 * Get file metadata
 */
export async function getFileMetadata(fileId: string) {
  try {
    const response = await drive.files.get({
      fileId,
      fields:
        "id, name, mimeType, size, webViewLink, webContentLink, thumbnailLink",
    });

    return response.data;
  } catch (error) {
    console.error("Error getting file metadata:", error);
    throw error;
  }
}

/**
 * Delete file from Google Drive
 */
export async function deleteFromGoogleDrive(fileId: string): Promise<void> {
  try {
    await drive.files.delete({ fileId });
  } catch (error) {
    console.error("Error deleting from Google Drive:", error);
    throw error;
  }
}

/**
 * Download file as buffer
 */
export async function downloadFromGoogleDrive(fileId: string): Promise<Buffer> {
  try {
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    return Buffer.from(response.data as ArrayBuffer);
  } catch (error) {
    console.error("Error downloading from Google Drive:", error);
    throw error;
  }
}

/**
 * Generate unique file key (similar to Firebase/R2)
 */
export function generateFileKey(
  eventId: string,
  filename: string,
  type: "original" | "thumbnail" | "watermarked" = "original"
): { fileName: string; folderPath: string[] } {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 15);
  const ext = filename.split(".").pop();

  const newFileName = `${timestamp}-${random}.${ext}`;

  if (type === "thumbnail") {
    return {
      fileName: newFileName,
      folderPath: ["events", eventId, "thumbnails"],
    };
  } else if (type === "watermarked") {
    return {
      fileName: newFileName,
      folderPath: ["events", eventId, "watermarked"],
    };
  }

  return {
    fileName: newFileName,
    folderPath: ["events", eventId, "photos"],
  };
}

/**
 * Get direct download URL (for public files)
 */
export function getDirectDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Get thumbnail URL
 */
export function getThumbnailUrl(fileId: string, size: number = 400): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}
