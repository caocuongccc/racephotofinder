// ============================================
// FILE: app/api/events/[id]/detect-faces/route.ts
// NEW: Run face detection on event photos
// ============================================
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDownloadUrl } from "@/lib/google-drive-oauth";
import * as faceapi from "face-api.js";
import canvas from "canvas";
import path from "path";

const { Canvas, Image, ImageData } = canvas;
// @ts-ignore
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;

async function loadModels() {
  if (modelsLoaded) return;

  const modelsPath = path.join(process.cwd(), "public", "models");
  console.log("📦 Loading models from:", modelsPath);

  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath),
    faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath),
    faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath),
  ]);

  modelsLoaded = true;
  console.log("✅ Models loaded");
}

async function detectFacesInPhoto(photoUrl: string): Promise<
  Array<{
    embedding: number[];
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>
> {
  try {
    await loadModels();

    // Download image
    const response = await fetch(photoUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Load image
    const img = await canvas.loadImage(buffer);
    const canvasEl = canvas.createCanvas(img.width, img.height);
    const ctx = canvasEl.getContext("2d");
    ctx.drawImage(img, 0, 0);

    // Detect faces
    const detections = await faceapi
      .detectAllFaces(canvasEl as any)
      .withFaceLandmarks()
      .withFaceDescriptors();

    return detections.map((detection) => ({
      embedding: Array.from(detection.descriptor),
      confidence: detection.detection.score,
      bbox: {
        x: detection.detection.box.x,
        y: detection.detection.box.y,
        width: detection.detection.box.width,
        height: detection.detection.box.height,
      },
    }));
  } catch (error: any) {
    console.error("❌ Face detection error:", error.message);
    return [];
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;

  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eventId = params.id;

    // Get photos without face detection
    const photos = await prisma.photo.findMany({
      where: {
        eventId,
        isProcessed: true,
        faceDetections: {
          none: {},
        },
      },
      take: 50, // Process 50 at a time
    });

    console.log(`🔍 Starting face detection for ${photos.length} photos...`);

    let processed = 0;
    let facesFound = 0;
    const errors: string[] = [];

    for (const photo of photos) {
      try {
        console.log(
          `📸 Processing photo ${photo.id} (${processed + 1}/${photos.length})`,
        );

        // Get photo URL
        const photoUrl = await getDownloadUrl(
          photo.uploadedBy,
          photo.driveFileId,
        );

        // Detect faces
        const faces = await detectFacesInPhoto(photoUrl);

        console.log(`   Found ${faces.length} faces`);

        // Save to database
        for (const face of faces) {
          await prisma.faceDetection.create({
            data: {
              photoId: photo.id,
              embedding: JSON.stringify(face.embedding),
              confidence: face.confidence,
              boundingBox: face.bbox,
            },
          });

          facesFound++;
        }

        processed++;
      } catch (error: any) {
        console.error(`❌ Error processing photo ${photo.id}:`, error.message);
        errors.push(`Photo ${photo.id}: ${error.message}`);
      }
    }

    console.log("✅ Face detection complete");
    console.log(`   Processed: ${processed} photos`);
    console.log(`   Faces found: ${facesFound}`);
    console.log(`   Errors: ${errors.length}`);

    // Log to activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: "batch_face_detection",
        entityType: "event",
        entityId: eventId,
        metadata: {
          photosProcessed: processed,
          facesFound,
          errors: errors.length > 0 ? errors : undefined,
        },
      },
    });

    return NextResponse.json({
      success: true,
      processed,
      facesFound,
      errors: errors.length > 0 ? errors : undefined,
      hasMore: photos.length === 50,
    });
  } catch (error: any) {
    console.error("❌ Batch face detection error:", error);
    return NextResponse.json(
      {
        error: "Face detection failed",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
