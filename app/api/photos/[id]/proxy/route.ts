// ============================================
// FILE: app/api/photos/[id]/proxy/route.ts
// PURPOSE: Proxy Google Drive images to avoid CORS
// ============================================
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUserDriveClient } from "@/lib/google-oauth";

/**
 * GET /api/photos/[id]/proxy?type=thumbnail|photo
 *
 * Serves Google Drive images through our server to avoid CORS issues
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "thumbnail";

  try {
    // Get photo from database
    const photo = await prisma.photo.findUnique({
      where: { id: params.id },
      select: {
        driveFileId: true,
        driveThumbnailId: true,
        uploadedBy: true,
        originalFilename: true,
      },
    });

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    if (!photo.uploadedBy) {
      return NextResponse.json(
        { error: "Photo uploader not found" },
        { status: 404 },
      );
    }

    // Determine which file to serve
    const fileId =
      type === "thumbnail" && photo.driveThumbnailId
        ? photo.driveThumbnailId
        : photo.driveFileId;

    console.log(`🖼️ Proxying ${type} for photo ${params.id.substring(0, 8)}`);

    // Get Drive client
    const drive = await getUserDriveClient(photo.uploadedBy);

    // Get file metadata to check it exists
    const metadata = await drive.files.get({
      fileId,
      fields: "mimeType, size",
    });

    // Download file
    const response = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" },
    );

    const buffer = Buffer.from(response.data as ArrayBuffer);

    // Return with proper headers
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": metadata.data.mimeType || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error: any) {
    console.error("❌ Proxy error:", error.message);

    // Return placeholder image on error
    return NextResponse.json(
      {
        error: "Failed to load image",
        message: error.message,
      },
      { status: 500 },
    );
  }
}
