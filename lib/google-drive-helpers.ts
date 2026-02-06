// ============================================
// FILE: lib/google-drive-helpers-fixed.ts
// FIXED: Proper Google Drive URLs with public access
// ============================================

/**
 * Generate Google Drive URLs - FIXED VERSION
 *
 * Google Drive có nhiều loại URLs:
 * 1. Direct download: Chỉ hoạt động nếu file PUBLIC
 * 2. Thumbnail: Auto-generated, PUBLIC mặc định
 * 3. Web view: Mở trong Google Drive UI
 */

export interface DriveUrls {
  // URL để hiển thị ảnh trực tiếp (thumbnail)
  thumbnailUrl: string;

  // URL để view ảnh full size (có thể dùng để hiển thị)
  photoUrl: string;

  // URL để download file gốc
  downloadUrl: string;

  // URL mở trong Google Drive
  webViewLink: string;
}

/**
 * Generate URLs from Google Drive file IDs
 *
 * IMPORTANT: Files MUST be set to public access
 */
export function generateDriveUrls(
  fileId: string,
  thumbnailId: string | null = null,
): DriveUrls {
  // ✅ THUMBNAIL: Always works if file is public
  // Format: https://drive.google.com/thumbnail?id={fileId}&sz=w{size}
  const thumbnailUrl = thumbnailId
    ? `https://drive.google.com/thumbnail?id=${thumbnailId}&sz=w800`
    : `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;

  // ✅ PHOTO URL: Direct link for viewing
  // This uses Google's content delivery network
  const photoUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

  // ✅ DOWNLOAD URL: Force download
  const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  // ✅ WEB VIEW: Open in Google Drive UI
  const webViewLink = `https://drive.google.com/file/d/${fileId}/view`;

  return {
    thumbnailUrl,
    photoUrl,
    downloadUrl,
    webViewLink,
  };
}

/**
 * Get different thumbnail sizes
 */
export function getDriveThumbnailUrl(
  fileId: string,
  size: 200 | 400 | 800 | 1200 | 1600 = 800,
): string {
  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w${size}`;
}

/**
 * Get direct download URL (forces download dialog)
 */
export function getDirectDownloadUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Get view URL (opens image in browser, no download dialog)
 */
export function getViewUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

/**
 * Validate Google Drive file ID format
 */
export function isValidDriveFileId(fileId: string): boolean {
  return /^[a-zA-Z0-9_-]{25,50}$/.test(fileId);
}

/**
 * Extract file ID from Google Drive URL
 */
export function extractFileIdFromUrl(url: string): string | null {
  const patterns = [/\/file\/d\/([a-zA-Z0-9_-]+)/, /[?&]id=([a-zA-Z0-9_-]+)/];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

/**
 * ⚠️ CRITICAL: Ensure file is publicly accessible
 * This should be called after uploading to Google Drive
 */
export async function ensurePublicAccess(
  userId: string,
  fileId: string,
): Promise<boolean> {
  try {
    const { getUserDriveClient } = await import("./google-oauth");
    const drive = await getUserDriveClient(userId);

    // Set permission to anyone with link can view
    await drive.permissions.create({
      fileId: fileId,
      requestBody: {
        role: "reader",
        type: "anyone",
      },
    });

    console.log(`✅ File ${fileId} is now public`);
    return true;
  } catch (error: any) {
    console.error(`❌ Failed to make file public: ${error.message}`);
    return false;
  }
}

/**
 * Batch make files public (for multiple uploads)
 */
export async function batchMakePublic(
  userId: string,
  fileIds: string[],
): Promise<{ success: string[]; failed: string[] }> {
  const success: string[] = [];
  const failed: string[] = [];

  for (const fileId of fileIds) {
    const result = await ensurePublicAccess(userId, fileId);
    if (result) {
      success.push(fileId);
    } else {
      failed.push(fileId);
    }
  }

  return { success, failed };
}

/**
 * Check if file is accessible (public check)
 */
export async function isDriveFileAccessible(fileId: string): Promise<boolean> {
  try {
    const thumbnailUrl = getDriveThumbnailUrl(fileId, 200);
    const response = await fetch(thumbnailUrl, { method: "HEAD" });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Get file info from Google Drive (requires auth)
 */
export async function getDriveFileInfo(
  userId: string,
  fileId: string,
): Promise<{
  name: string;
  mimeType: string;
  size: number;
  webViewLink: string;
  thumbnailLink?: string;
} | null> {
  try {
    const { getUserDriveClient } = await import("./google-oauth");
    const drive = await getUserDriveClient(userId);

    const response = await drive.files.get({
      fileId,
      fields: "name,mimeType,size,webViewLink,thumbnailLink",
    });

    return response.data as any;
  } catch (error) {
    console.error("Error getting file info:", error);
    return null;
  }
}
