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

// POST /api/photos/[id]/confirm - Confirm upload and process photo
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const params = await context.params;

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get photo record
    const photo = await prisma.photo.findUnique({
      where: { id: params.id },
    });

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Verify uploader
    if (photo.uploadedBy !== session.user.id && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Get file from form data
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    console.log("📤 Processing upload:", {
      photoId: params.id,
      filename: file.name,
      size: file.size,
      type: file.type,
    });

    try {
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      console.log("✅ File converted to buffer");

      // Get image metadata
      const metadata = await sharp(buffer).metadata();

      console.log("✅ Image metadata:", {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
      });

      // Generate thumbnail (max 400px width)
      const thumbnailBuffer = await sharp(buffer)
        .resize(400, null, {
          withoutEnlargement: true,
          fit: "inside",
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      console.log("✅ Thumbnail generated");

      // Generate unique filenames
      const originalFileName = generateImgbbFileName(
        photo.eventId,
        file.name,
        "original"
      );
      const thumbnailFileName = generateImgbbFileName(
        photo.eventId,
        file.name,
        "thumbnail"
      );

      console.log("📤 Uploading to Imgbb...");

      // Upload both images to Imgbb in parallel
      const [originalUpload, thumbnailUpload] = await Promise.all([
        uploadToImgbb(buffer, originalFileName),
        uploadToImgbb(thumbnailBuffer, thumbnailFileName),
      ]);

      console.log("✅ Uploaded to Imgbb:", {
        originalId: originalUpload.id,
        thumbnailId: thumbnailUpload.id,
      });

      // Update photo record với URLs từ Imgbb
      const updatedPhoto = await prisma.photo.update({
        where: { id: params.id },
        data: {
          driveFileId: originalUpload.url, // URL gốc từ Imgbb
          driveThumbnailId: thumbnailUpload.thumbnailUrl, // Thumbnail URL
          width: metadata.width,
          height: metadata.height,
          fileSize: buffer.length,
          isProcessed: true,
        },
      });

      console.log("✅ Database updated");

      // AUTO-DETECT BIB & TAG (chạy async, không block response)
      autoDetectAndTag(
        updatedPhoto.id,
        originalUpload.url,
        photo.eventId
      ).catch((err) => {
        console.error("❌ Auto-detect failed:", err);
      });

      return NextResponse.json({
        success: true,
        photo: updatedPhoto,
      });
    } catch (processError: any) {
      console.error("❌ Error processing image FULL:", {
        message: processError.message,
        stack: processError.stack,
      });

      // Update photo status as error
      await prisma.photo.update({
        where: { id: params.id },
        data: {
          isProcessed: false,
        },
      });

      return NextResponse.json(
        {
          error: "Failed to process image",
          details: processError.message,
        },
        { status: 500 }
      );
    }
  } catch (error: any) {
    console.error("❌ Error confirming upload:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// Auto-detect BIB numbers and tag photos (background job)
async function autoDetectAndTag(
  photoId: string,
  photoUrl: string,
  eventId: string
) {
  try {
    console.log("🔍 Auto-detecting BIB for photo:", photoId);

    // Import OCR service
    const { extractBibNumbers } = await import("@/lib/ocr");

    // Extract BIB numbers using OCR
    const detections = await extractBibNumbers(photoUrl);

    if (detections.length === 0) {
      console.log("⚠️ No BIB numbers detected");
      return;
    }

    console.log(
      "✅ Detected BIBs:",
      detections.map((d) => d.bibNumber)
    );

    // Find matching runners
    const runners = await prisma.runner.findMany({
      where: {
        eventId,
        bibNumber: {
          in: detections.map((d) => d.bibNumber),
        },
      },
    });

    if (runners.length === 0) {
      console.log("⚠️ No matching runners found");
      return;
    }

    console.log(
      "✅ Found runners:",
      runners.map((r) => `${r.bibNumber} - ${r.fullName}`)
    );

    // Auto-tag photo with detected runners
    await prisma.photoTag.createMany({
      data: runners.map((runner) => {
        const detection = detections.find(
          (d) => d.bibNumber === runner.bibNumber
        );
        return {
          photoId,
          runnerId: runner.id,
          confidence: detection?.confidence || 0.7,
          taggedBy: null, // Auto-tagged by system
        };
      }),
      skipDuplicates: true,
    });

    console.log("✅ Auto-tagged photo with", runners.length, "runners");

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: null,
        action: "auto_tag_photo",
        entityType: "photo",
        entityId: photoId,
        metadata: {
          detectedBibs: detections.map((d) => d.bibNumber),
          matchedRunners: runners.length,
        },
      },
    });
  } catch (error) {
    console.error("❌ Auto-detect error:", error);
  }
}
