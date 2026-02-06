// ============================================
// FILE: app/api/events/[id]/search-by-face/route.ts
// IMPROVED: Better face matching algorithm
// ============================================
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateDriveUrls } from "@/lib/google-drive-helpers";
import * as faceapi from "face-api.js";
import canvas from "canvas";
import path from "path";

// Setup face-api.js for Node.js
const { Canvas, Image, ImageData } = canvas;
// @ts-ignore
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;

async function loadModels() {
  if (modelsLoaded) return;

  const modelsPath = path.join(process.cwd(), "public", "models");

  console.log("📦 Loading face detection models from:", modelsPath);

  try {
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath),
      faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath),
      faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath),
    ]);

    modelsLoaded = true;
    console.log("✅ Face detection models loaded");
  } catch (error: any) {
    console.error("❌ Failed to load models:", error.message);
    throw new Error("Face detection models not available");
  }
}

/**
 * Extract face descriptor from uploaded image
 */
async function detectFaceFromUpload(
  imageBuffer: Buffer,
): Promise<Float32Array | null> {
  try {
    await loadModels();

    // Load image
    const img = await canvas.loadImage(imageBuffer);
    const canvasEl = canvas.createCanvas(img.width, img.height);
    const ctx = canvasEl.getContext("2d");
    ctx.drawImage(img, 0, 0);

    console.log("🔍 Detecting faces in uploaded image...");

    // Detect faces with landmarks and descriptors
    const detections = await faceapi
      .detectAllFaces(canvasEl as any)
      .withFaceLandmarks()
      .withFaceDescriptors();

    console.log(`✅ Found ${detections.length} faces in upload`);

    if (detections.length === 0) {
      return null;
    }

    // Use the largest face (most likely the main subject)
    const largestFace = detections.reduce((prev, current) =>
      current.detection.box.area > prev.detection.box.area ? current : prev,
    );

    console.log(
      `✅ Using largest face (confidence: ${largestFace.detection.score.toFixed(2)})`,
    );

    return largestFace.descriptor;
  } catch (error: any) {
    console.error("❌ Face detection error:", error.message);
    return null;
  }
}

/**
 * Calculate Euclidean distance between two face descriptors
 */
function getFaceDistance(desc1: Float32Array, desc2: Float32Array): number {
  return faceapi.euclideanDistance(desc1, desc2);
}

/**
 * Check if face detection has been run on photos
 */
async function ensureFaceDetections(eventId: string) {
  const photosWithoutFaces = await prisma.photo.findMany({
    where: {
      eventId,
      isProcessed: true,
      faceDetections: {
        none: {},
      },
    },
    take: 100, // Process up to 100 at a time
  });

  if (photosWithoutFaces.length > 0) {
    console.log(
      `⚠️ Found ${photosWithoutFaces.length} photos without face detection`,
    );
    console.log("💡 Consider running batch face detection in background");
    // Note: Actual face detection should be done in a background job
    // This is just to alert that it's needed
  }

  const totalFaces = await prisma.faceDetection.count({
    where: {
      photo: {
        eventId,
      },
    },
  });

  console.log(`📊 Event has ${totalFaces} face detections total`);

  return totalFaces > 0;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;

  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const eventId = params.id;

    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Get uploaded image
    const formData = await request.formData();
    const file = formData.get("image") as File;

    if (!file) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    console.log("🔍 Processing face search request...");
    console.log("   Event:", event.name);
    console.log("   Uploaded image:", file.name, file.size, "bytes");

    // Check if face detection has been run
    const hasFaceDetections = await ensureFaceDetections(eventId);

    if (!hasFaceDetections) {
      return NextResponse.json(
        {
          error: "No face detections available",
          message:
            "Face detection needs to be run on event photos first. Please contact admin.",
        },
        { status: 400 },
      );
    }

    // Extract face descriptor from uploaded image
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadedFaceDescriptor = await detectFaceFromUpload(buffer);

    if (!uploadedFaceDescriptor) {
      return NextResponse.json(
        {
          error: "No face detected",
          message:
            "Could not detect a face in the uploaded image. Please upload a clear photo with a visible face.",
        },
        { status: 400 },
      );
    }

    console.log("✅ Face descriptor extracted from upload");

    // Get all photos with face detections
    const photosWithFaces = await prisma.photo.findMany({
      where: {
        eventId,
        isProcessed: true,
        faceDetections: {
          some: {},
        },
      },
      include: {
        faceDetections: true,
        tags: {
          include: {
            runner: true,
          },
        },
        uploader: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    console.log(`📸 Comparing against ${photosWithFaces.length} photos`);

    // Calculate distances and find matches
    const matches: Array<{
      photo: any;
      distance: number;
      similarity: number;
    }> = [];

    for (const photo of photosWithFaces) {
      for (const faceDetection of photo.faceDetections) {
        if (!faceDetection.embedding) {
          console.warn(
            `⚠️ Face detection ${faceDetection.id} missing embedding`,
          );
          continue;
        }

        try {
          // Parse stored embedding
          const storedDescriptor = new Float32Array(
            JSON.parse(faceDetection.embedding as string),
          );

          // Calculate distance
          const distance = getFaceDistance(
            uploadedFaceDescriptor,
            storedDescriptor,
          );

          // Convert distance to similarity percentage (lower distance = higher similarity)
          // Typical face match threshold is 0.6
          // Distance < 0.4 = very likely same person
          // Distance < 0.6 = likely same person
          // Distance > 0.6 = different person
          const similarity = Math.max(0, (1 - distance / 0.6) * 100);

          if (distance < 0.7) {
            // Relaxed threshold for better recall
            matches.push({
              photo,
              distance,
              similarity: Math.round(similarity),
            });
          }
        } catch (err: any) {
          console.error(
            `❌ Error processing face detection ${faceDetection.id}:`,
            err.message,
          );
        }
      }
    }

    // Sort by similarity (highest first)
    matches.sort((a, b) => a.distance - b.distance);

    console.log(`✅ Found ${matches.length} potential matches`);

    if (matches.length > 0) {
      console.log("   Top match:");
      console.log(`      Distance: ${matches[0].distance.toFixed(3)}`);
      console.log(`      Similarity: ${matches[0].similarity}%`);
    }

    // Take top 50 matches
    const topMatches = matches.slice(0, 50);

    // Generate URLs for matched photos
    const photosWithUrls = topMatches.map((match) => {
      const photo = match.photo;

      if (!photo.driveFileId || !photo.driveThumbnailId) {
        return {
          ...photo,
          distance: match.distance,
          similarity: match.similarity,
          thumbnailUrl: null,
          photoUrl: null,
        };
      }

      const urls = generateDriveUrls(photo.driveFileId, photo.driveThumbnailId);

      return {
        ...photo,
        distance: match.distance,
        similarity: match.similarity,
        thumbnailUrl: urls.thumbnailUrl,
        photoUrl: urls.photoUrl,
        downloadUrl: urls.downloadUrl,
      };
    });

    return NextResponse.json({
      success: true,
      matches: photosWithUrls,
      total: photosWithUrls.length,
      stats: {
        photosSearched: photosWithFaces.length,
        matchesFound: matches.length,
        topReturned: topMatches.length,
      },
    });
  } catch (error: any) {
    console.error("❌ Face search error:", error);
    return NextResponse.json(
      {
        error: "Face search failed",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
