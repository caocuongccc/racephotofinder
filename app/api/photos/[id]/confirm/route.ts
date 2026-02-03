// ============================================
// FILE 2: app/api/photos/[id]/confirm/route.ts
// THAY THẾ HOÀN TOÀN
// ============================================
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import sharp from "sharp";
import { uploadToImgbb, generateImgbbFileName } from "@/lib/imgbb";
import { generateFileKey, uploadToGoogleDrive } from "@/lib/google-drive-oauth";

// POST /api/photos/[id]/confirm - Confirm upload and process photo
// app/api/photos/[id]/confirm/route.ts
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;

  try {
    const session = await getServerSession(authOptions);
    console.log("📤 Upload session:", {
      userId: session?.user?.id,
      role: session?.user?.role,
      photoId: params.id,
    });

    if (!session) {
      return NextResponse.json(
        {
          error: "Unauthorized - No session found",
        },
        { status: 401 },
      );
    }
    // Check if user has connected Google Drive
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { googleAccessToken: true },
    });

    if (!user?.googleAccessToken) {
      return NextResponse.json(
        { error: "Please connect your Google Drive account first" },
        { status: 400 },
      );
    }
    // Get photo record với error checking
    const photo = await prisma.photo.findUnique({
      where: { id: params.id },
      include: {
        event: true,
        uploader: true,
      },
    });

    if (!photo) {
      console.error("❌ Photo not found:", params.id);
      return NextResponse.json(
        {
          error: "Photo record not found",
        },
        { status: 404 },
      );
    }

    console.log("✅ Photo record found:", {
      photoId: photo.id,
      eventId: photo.eventId,
      uploadedBy: photo.uploadedBy,
    });

    // Verify permissions với chi tiết hơn
    const isUploader = photo.uploadedBy === session.user.id;
    const isAdmin = session.user.role === "admin";
    const hasPermission = isUploader || isAdmin;

    if (!hasPermission) {
      console.error("❌ Permission denied:", {
        sessionUserId: session.user.id,
        photoUploaderId: photo.uploadedBy,
        userRole: session.user.role,
      });
      return NextResponse.json(
        {
          error: "Forbidden - No permission to confirm this upload",
        },
        { status: 403 },
      );
    }

    // Get file from form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      console.error("❌ No file in form data");
      return NextResponse.json(
        {
          error: "No file provided",
        },
        { status: 400 },
      );
    }

    console.log("📤 Processing upload:", {
      filename: file.name,
      size: file.size,
      type: file.type,
    });

    // Convert to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log("✅ Buffer created:", buffer.length, "bytes");

    // Get metadata
    const metadata = await sharp(buffer).metadata();
    console.log("✅ Image metadata:", {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    });

    // Generate thumbnail
    const thumbnailBuffer = await sharp(buffer)
      .resize(400, null, {
        withoutEnlargement: true,
        fit: "inside",
      })
      .jpeg({ quality: 80 })
      .toBuffer();
    console.log("✅ Thumbnail generated:", thumbnailBuffer.length, "bytes");

    // Upload to Google Drive
    const originalKey = generateFileKey(
      photo.eventId,
      photo.originalFilename!,
      "original",
    );
    const thumbnailKey = generateFileKey(
      photo.eventId,
      photo.originalFilename!,
      "thumbnail",
    );

    console.log("📤 Uploading to Google Drive:", {
      originalPath: originalKey.folderPath.join("/"),
      thumbnailPath: thumbnailKey.folderPath.join("/"),
    });

    const [originalUpload, thumbnailUpload] = await Promise.all([
      uploadToGoogleDrive(
        originalKey.fileName,
        buffer,
        "image/jpeg",
        originalKey.folderPath,
      ).catch((err) => {
        console.error("❌ Original upload failed:", err);
        throw new Error(`Failed to upload original: ${err.message}`);
      }),
      uploadToGoogleDrive(
        thumbnailKey.fileName,
        thumbnailBuffer,
        "image/jpeg",
        thumbnailKey.folderPath,
      ).catch((err) => {
        console.error("❌ Thumbnail upload failed:", err);
        throw new Error(`Failed to upload thumbnail: ${err.message}`);
      }),
    ]);

    console.log("✅ Uploaded to Google Drive:", {
      originalId: originalUpload.fileId,
      thumbnailId: thumbnailUpload.fileId,
    });

    // Update database
    const updatedPhoto = await prisma.photo.update({
      where: { id: params.id },
      data: {
        driveFileId: originalUpload.fileId,
        driveThumbnailId: thumbnailUpload.fileId,
        width: metadata.width,
        height: metadata.height,
        fileSize: buffer.length,
        isProcessed: true,
      },
    });

    console.log("✅ Database updated successfully");

    // AUTO-DETECT BIB & TAG (async, non-blocking)
    autoDetectAndTag(
      updatedPhoto.id,
      originalUpload.fileId,
      photo.eventId,
    ).catch((err) => {
      console.error("❌ Auto-detect failed:", err);
      // Log to database for debugging
      prisma.activityLog
        .create({
          data: {
            userId: session.user.id,
            action: "auto_detect_failed",
            entityType: "photo",
            entityId: updatedPhoto.id,
            metadata: {
              error: err.message,
              stack: err.stack,
            },
          },
        })
        .catch(console.error);
    });

    return NextResponse.json({
      success: true,
      photo: updatedPhoto,
    });
  } catch (error: any) {
    console.error("❌ Upload confirmation error:", {
      message: error.message,
      stack: error.stack,
      photoId: params.id,
    });

    // Update photo status as error
    try {
      await prisma.photo.update({
        where: { id: params.id },
        data: {
          isProcessed: false,
        },
      });
    } catch (dbError) {
      console.error("❌ Failed to update photo error status:", dbError);
    }

    return NextResponse.json(
      {
        error: "Failed to process upload",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
async function autoDetectAndTag(
  photoId: string,
  driveFileId: string,
  eventId: string,
) {
  try {
    console.log("🔍 Auto-detecting BIB for photo:", photoId);

    const { multiRegionOCR } = await import("@/lib/ocr");
    const { getDirectDownloadUrl } = await import("@/lib/google-drive");

    const photoUrl = getDirectDownloadUrl(driveFileId);

    // Use improved multi-region OCR
    const detections = await multiRegionOCR(photoUrl);

    if (detections.length === 0) {
      console.log("⚠️ No BIB numbers detected");

      // Log for review
      await prisma.activityLog.create({
        data: {
          userId: null,
          action: "auto_detect_no_results",
          entityType: "photo",
          entityId: photoId,
          metadata: { eventId },
        },
      });

      return;
    }

    console.log("✅ Detected BIBs:", detections);

    // Find matching runners
    const bibNumbers = detections.map((d) => d.bibNumber);
    const runners = await prisma.runner.findMany({
      where: {
        eventId,
        bibNumber: { in: bibNumbers },
      },
    });

    if (runners.length === 0) {
      console.log("⚠️ No matching runners found for:", bibNumbers);

      // Log for manual review
      await prisma.activityLog.create({
        data: {
          userId: null,
          action: "auto_detect_no_match",
          entityType: "photo",
          entityId: photoId,
          metadata: {
            detectedBibs: bibNumbers,
            eventId,
          },
        },
      });

      return;
    }

    console.log("✅ Found runners:", runners);

    // Delete existing auto-tags (keep manual tags)
    await prisma.photoTag.deleteMany({
      where: {
        photoId,
        taggedBy: null, // Auto-tagged
      },
    });

    // Create new auto-tags
    await prisma.photoTag.createMany({
      data: runners.map((runner) => {
        const detection = detections.find(
          (d) => d.bibNumber === runner.bibNumber,
        );
        return {
          photoId,
          runnerId: runner.id,
          confidence: detection?.confidence || 0.7,
          taggedBy: null, // Auto-tagged
        };
      }),
      skipDuplicates: true,
    });

    console.log("✅ Auto-tagged photo with", runners.length, "runners");

    // Log success
    await prisma.activityLog.create({
      data: {
        userId: null,
        action: "auto_tag_success",
        entityType: "photo",
        entityId: photoId,
        metadata: {
          detectedBibs: bibNumbers,
          matchedRunners: runners.length,
          confidence: detections.map((d) => d.confidence),
        },
      },
    });
  } catch (error: any) {
    console.error("❌ Auto-detect error:", error);

    // Log error
    await prisma.activityLog
      .create({
        data: {
          userId: null,
          action: "auto_detect_error",
          entityType: "photo",
          entityId: photoId,
          metadata: {
            error: error.message,
            stack: error.stack,
          },
        },
      })
      .catch(console.error);
  }
}
