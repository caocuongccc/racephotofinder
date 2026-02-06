// ============================================
// FILE: app/api/photos/[id]/confirm/route.ts
// WITH MULTI-ENGINE OCR SUPPORT
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
import { ensurePublicAccess } from "@/lib/google-drive-helpers";
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

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const metadata = await sharp(buffer).metadata();
    console.log("✅ Image metadata:", {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
    });

    const thumbnailBuffer = await sharp(buffer)
      .resize(400, null, {
        withoutEnlargement: true,
        fit: "inside",
      })
      .jpeg({ quality: 80 })
      .toBuffer();

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
        session.user.id,
        originalKey.fileName,
        buffer,
        "image/jpeg",
        originalKey.folderPath,
      ).catch((err) => {
        console.error("❌ Original upload failed:", err);
        throw new Error(`Failed to upload original: ${err.message}`);
      }),
      uploadToGoogleDrive(
        session.user.id,
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
    // ✅ CRITICAL: Make files publicly accessible
    console.log("🔓 Making files public...");

    await Promise.all([
      ensurePublicAccess(session.user.id, originalUpload.fileId),
      ensurePublicAccess(session.user.id, thumbnailUpload.fileId),
    ]);

    console.log("✅ Files are now public");
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
    // MULTI-ENGINE OCR (BACKGROUND)
    // ============================================
    console.log("🔍 Starting multi-engine auto-detect (background)...");

    setImmediate(() => {
      autoDetectMultiEngine(
        updatedPhoto.id,
        originalUpload.fileId,
        photo.eventId,
        session.user.id,
      ).catch((err) => {
        console.error("❌ Auto-detect failed:", err.message);
      });
    });

    return NextResponse.json({
      success: true,
      photo: updatedPhoto,
      message: "Upload successful. BIB detection running in background.",
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
// AUTO-DETECT WITH MULTI-ENGINE OCR
// ============================================
async function autoDetectMultiEngine(
  photoId: string,
  driveFileId: string,
  eventId: string,
  userId: string,
) {
  try {
    console.log("🔍 [Background] Auto-detecting BIB for photo:", photoId);

    const { getDownloadUrl } = await import("@/lib/google-drive-oauth");

    console.log("📥 [Background] Getting download URL...");
    const photoUrl = await getDownloadUrl(userId, driveFileId);
    console.log("✅ [Background] Photo URL obtained");

    // ✅ MULTI-ENGINE: Try all OCR services
    console.log("🔍 [Background] Running multi-engine OCR...");

    const { detectBibNumbersMultiEngine } = await import("@/lib/ocr-space-api");

    const detections = await Promise.race([
      detectBibNumbersMultiEngine(photoUrl, userId),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("OCR timeout (30s)")), 30000),
      ),
    ]).catch((err) => {
      console.error("❌ [Background] All OCR engines failed:", err.message);
      return [];
    });

    console.log(`✅ [Background] OCR returned ${detections.length} detections`);

    if (detections.length === 0) {
      console.log("⚠️ [Background] No BIB numbers detected");

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
      "✅ [Background] Detected BIBs:",
      detections.map((d) => ({
        bib: d.bibNumber,
        conf: Math.round(d.confidence * 100) + "%",
      })),
    );

    const bibNumbers = detections.map((d) => d.bibNumber);

    const existingRunners = await prisma.runner.findMany({
      where: {
        eventId,
        bibNumber: { in: bibNumbers },
      },
    });

    console.log(
      `✅ [Background] Found ${existingRunners.length} existing runners`,
    );

    const existingBibNumbers = new Set(existingRunners.map((r) => r.bibNumber));
    const newBibNumbers = bibNumbers.filter(
      (bib) => !existingBibNumbers.has(bib),
    );

    if (newBibNumbers.length > 0) {
      console.log("✅ [Background] Auto-creating runners:", newBibNumbers);

      await prisma.runner.createMany({
        data: newBibNumbers.map((bibNumber) => ({
          eventId,
          bibNumber,
          fullName: `Runner ${bibNumber}`,
        })),
        skipDuplicates: true,
      });

      console.log(
        `✅ [Background] Created ${newBibNumbers.length} new runners`,
      );
    }

    const allRunners = await prisma.runner.findMany({
      where: {
        eventId,
        bibNumber: { in: bibNumbers },
      },
    });

    console.log(`✅ [Background] Total runners to tag: ${allRunners.length}`);

    if (allRunners.length === 0) {
      console.log("⚠️ [Background] No runners found");
      return;
    }

    await prisma.photoTag.deleteMany({
      where: {
        photoId,
        taggedBy: null,
      },
    });

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

    console.log(
      "✅ [Background] Auto-tagged photo with",
      allRunners.length,
      "runners",
    );

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

    console.log("✅ [Background] Auto-detect completed successfully");
  } catch (error: any) {
    console.error("❌ [Background] Auto-detect error:", error.message);

    await prisma.activityLog
      .create({
        data: {
          userId: null,
          action: "auto_detect_error",
          entityType: "photo",
          entityId: photoId,
          metadata: {
            error: error.message,
          },
        },
      })
      .catch(console.error);
  }
}
