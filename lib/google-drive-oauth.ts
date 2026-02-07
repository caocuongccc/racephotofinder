// lib/google-drive-oauth.ts
import { Readable } from "stream";
import { getUserDriveClient } from "./google-oauth";
import prisma from "./prisma";

/**
 * Get or create user's RacePhotos folder
 */
async function getUserFolder(userId: string): Promise<string> {
  // Check if user already has folder
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleDriveFolderId: true },
  });

  if (user?.googleDriveFolderId) {
    return user.googleDriveFolderId;
  }

  // Create folder
  const drive = await getUserDriveClient(userId);
  const folderName = process.env.GOOGLE_DRIVE_FOLDER_NAME || "RacePhotos";

  // Check if folder exists
  const existing = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: "files(id, name)",
  });
  console.log(
    "🔍 Checking for existing user folder in Google Drive...",
    existing,
  );
  let folderId: string;

  if (existing.data.files && existing.data.files.length > 0) {
    folderId = existing.data.files[0].id!;
    console.log(`✅ Found existing folder: ${folderId}`);
  } else {
    const folder = await drive.files.create({
      requestBody: {
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      },
      fields: "id",
    });
    folderId = folder.data.id!;
    console.log(`✅ Created folder: ${folderId}`);
  }

  // Store folder ID
  await prisma.user.update({
    where: { id: userId },
    data: { googleDriveFolderId: folderId },
  });

  return folderId;
}

/**
 * Get or create subfolder
 */
async function getOrCreateFolder(
  userId: string,
  folderName: string,
  parentId: string,
): Promise<string> {
  const drive = await getUserDriveClient(userId);

  // Check if exists
  const response = await drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: "files(id, name)",
  });

  if (response.data.files && response.data.files.length > 0) {
    return response.data.files[0].id!;
  }

  // Create folder
  const folder = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });

  return folder.data.id!;
}

/**
 * Upload file to user's Google Drive
 */
export async function uploadToGoogleDrive(
  userId: string,
  fileName: string,
  buffer: Buffer,
  mimeType: string,
  folderPath: string[] = [], // ['events', 'event-id', 'photos']
): Promise<{ fileId: string; webViewLink: string; webContentLink: string }> {
  try {
    const drive = await getUserDriveClient(userId);

    // Get user's main folder
    let currentParentId = await getUserFolder(userId);

    // Create nested folders
    for (const folderName of folderPath) {
      currentParentId = await getOrCreateFolder(
        userId,
        folderName,
        currentParentId,
      );
    }

    console.log("📤 Uploading to user's Drive:", fileName);

    // Convert buffer to stream
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);

    // Upload file
    const response = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [currentParentId],
      },
      media: {
        mimeType,
        body: readable,
      },
      fields: "id, webViewLink, webContentLink",
    });

    console.log("✅ Uploaded:", response.data.id);

    // Make file accessible (optional - only if needed for public access)
    await drive.permissions.create({
      fileId: response.data.id!,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    return {
      fileId: response.data.id!,
      webViewLink: response.data.webViewLink || "",
      webContentLink: response.data.webContentLink || "",
    };
  } catch (error: any) {
    console.error("❌ Upload error:", error.message);

    if (error.message?.includes("not authorized")) {
      throw new Error(
        "Google Drive access expired. Please reconnect your Google account.",
      );
    }

    throw error;
  }
}

/**
 * Get download URL for file
 */
export async function getDownloadUrl(
  userId: string,
  fileId: string,
  expiresIn: number = 3600,
): Promise<string> {
  const drive = await getUserDriveClient(userId);

  // For files in user's Drive, direct download works
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Get thumbnail URL
 */
export function getThumbnailUrl(fileId: string, size: number = 400): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

/**
 * Delete file from Drive
 */
export async function deleteFromGoogleDrive(
  userId: string,
  fileId: string,
): Promise<void> {
  const drive = await getUserDriveClient(userId);
  await drive.files.delete({ fileId });
}

/**
 * Generate file key (folder structure)
 */
export function generateFileKey(
  eventId: string,
  filename: string,
  type: "original" | "thumbnail" | "watermarked" = "original",
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
