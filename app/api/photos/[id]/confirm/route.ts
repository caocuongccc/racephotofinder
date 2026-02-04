// ============================================
// FILE: app/api/photos/[id]/confirm/route.ts
// FINAL VERSION - Google OAuth + Optimized OCR
// ============================================
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import sharp from "sharp";
import {
  uploadToGoogleDrive,
  generateFileKey,
  getDownloadUrl,
} from "@/lib/google-drive-oauth";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;

  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized - No session found" },
        { status: 401 },
      );
    }

    // ============================================
    // 1. CHECK GOOGLE DRIVE CONNECTION
    // ============================================
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        googleAccessToken: true,
        googleRefreshToken: true,
      },
    });

    if (!user?.googleAccessToken || !user?.googleRefreshToken) {
      return NextResponse.json(
        {
          error: "Please connect your Google Drive account first",
          needsAuth: true,
        },
        { status: 400 },
      );
    }

    console.log("✅ Google Drive connected for user:", session.user.email);

    // ============================================
    // 2. GET PHOTO RECORD & VERIFY PERMISSION
    // ============================================
    const photo = await prisma.photo.findUnique({
      where: { id: params.id },
      include: {
        event: true,
        uploader: true,
      },
    });

    if (!photo) {
      return NextResponse.json(
        { error: "Photo record not found" },
        { status: 404 },
      );
    }

    const isUploader = photo.uploadedBy === session.user.id;
    const isAdmin = session.user.role === "admin";

    if (!isUploader && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden - No permission" },
        { status: 403 },
      );
    }

    // ============================================
    // 3. GET FILE FROM FORM DATA
    // ============================================
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log("📤 Processing upload:", {
      filename: file.name,
      size: file.size,
      type: file.type,
    });

    // ============================================
    // 4. PROCESS IMAGE
    // ============================================
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

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

    // ============================================
    // 5. UPLOAD TO GOOGLE DRIVE (USER'S DRIVE)
    // ============================================
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

    console.log("📤 Uploading to user's Google Drive...");

    const [originalUpload, thumbnailUpload] = await Promise.all([
      uploadToGoogleDrive(
        session.user.id, // ✅ userId for OAuth
        originalKey.fileName,
        buffer,
        "image/jpeg",
        originalKey.folderPath,
      ).catch((err) => {
        console.error("❌ Original upload failed:", err);
        throw new Error(`Failed to upload original: ${err.message}`);
      }),
      uploadToGoogleDrive(
        session.user.id, // ✅ userId for OAuth
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

    // ============================================
    // 6. UPDATE DATABASE
    // ============================================
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

    // ============================================
    // 7. AUTO-DETECT & AUTO-CREATE RUNNERS (ASYNC)
    // ============================================
    autoDetectAndCreateRunner(
      updatedPhoto.id,
      originalUpload.fileId,
      photo.eventId,
      session.user.id,
    ).catch((err) => {
      console.error("❌ Auto-detect failed:", err);
      prisma.activityLog
        .create({
          data: {
            userId: session.user.id,
            action: "auto_detect_failed",
            entityType: "photo",
            entityId: updatedPhoto.id,
            metadata: {
              error: err.message,
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
    console.error("❌ Upload confirmation error:", error);

    try {
      await prisma.photo.update({
        where: { id: params.id },
        data: { isProcessed: false },
      });
    } catch (dbError) {
      console.error("❌ Failed to update photo status:", dbError);
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

// ============================================
// AUTO-DETECT WITH OPTIMIZED OCR
// ============================================
async function autoDetectAndCreateRunner(
  photoId: string,
  driveFileId: string,
  eventId: string,
  userId: string,
) {
  try {
    console.log("🔍 Auto-detecting BIB for photo:", photoId);

    // Import optimized OCR
    const { detectBibNumbersOptimized } = await import("@/lib/ocr-optimized");
    const { getDownloadUrl } = await import("@/lib/google-drive-oauth");

    // Get photo URL
    const photoUrl = await getDownloadUrl(userId, driveFileId);

    // ============================================
    // OPTIMIZED OCR DETECTION
    // Handles: blur, skew, noise, low contrast
    // ============================================
    const detections = await detectBibNumbersOptimized(photoUrl);

    if (detections.length === 0) {
      console.log("⚠️ No BIB numbers detected");

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

    console.log(
      "✅ Detected BIBs:",
      detections.map((d) => ({
        bib: d.bibNumber,
        conf: Math.round(d.confidence * 100) + "%",
        region: d.region,
      })),
    );

    // ============================================
    // AUTO-CREATE RUNNERS IF NOT EXISTS
    // ============================================
    const bibNumbers = detections.map((d) => d.bibNumber);

    const existingRunners = await prisma.runner.findMany({
      where: {
        eventId,
        bibNumber: { in: bibNumbers },
      },
    });

    const existingBibNumbers = new Set(existingRunners.map((r) => r.bibNumber));

    const newBibNumbers = bibNumbers.filter(
      (bib) => !existingBibNumbers.has(bib),
    );

    // Create new runners
    if (newBibNumbers.length > 0) {
      console.log("✅ Auto-creating runners for BIBs:", newBibNumbers);

      await prisma.runner.createMany({
        data: newBibNumbers.map((bibNumber) => ({
          eventId,
          bibNumber,
          fullName: null,
          isAutoDetected: true,
          isVerified: false,
        })),
        skipDuplicates: true,
      });

      console.log(`✅ Created ${newBibNumbers.length} new runners`);
    }

    // Get all runners
    const allRunners = await prisma.runner.findMany({
      where: {
        eventId,
        bibNumber: { in: bibNumbers },
      },
    });

    if (allRunners.length === 0) {
      console.log("⚠️ No runners found after auto-create");
      return;
    }

    // Delete existing auto-tags
    await prisma.photoTag.deleteMany({
      where: {
        photoId,
        taggedBy: null,
      },
    });

    // Create new tags
    await prisma.photoTag.createMany({
      data: allRunners.map((runner) => {
        const detection = detections.find(
          (d) => d.bibNumber === runner.bibNumber,
        );
        return {
          photoId,
          runnerId: runner.id,
          confidence: detection?.confidence || 0.7,
          taggedBy: null,
        };
      }),
      skipDuplicates: true,
    });

    console.log("✅ Auto-tagged photo with", allRunners.length, "runners");

    // Log success
    await prisma.activityLog.create({
      data: {
        userId: null,
        action: "auto_detect_success",
        entityType: "photo",
        entityId: photoId,
        metadata: {
          detectedBibs: bibNumbers,
          createdRunners: newBibNumbers,
          totalTagged: allRunners.length,
          avgConfidence:
            Math.round(
              (detections.reduce((sum, d) => sum + d.confidence, 0) /
                detections.length) *
                100,
            ) / 100,
        },
      },
    });
  } catch (error: any) {
    console.error("❌ Auto-detect error:", error);

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
