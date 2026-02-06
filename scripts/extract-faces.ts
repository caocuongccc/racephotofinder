// scripts/extract-faces.ts
import prisma from "@/lib/prisma";
import { google } from "googleapis";
import * as faceapi from "face-api.js";
import canvas from "canvas";
import path from "path";

const { Canvas, Image } = canvas;
// @ts-ignore
faceapi.env.monkeyPatch({ Canvas, Image });

async function extractAllFaces() {
  // Load models
  const modelsPath = path.join(process.cwd(), "public", "models");

  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath),
    faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath),
    faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath),
  ]);
  console.log("📦 Loading models from", modelsPath);
  console.log("✅ Models loaded");

  // Get photos without face embeddings
  const photos = await prisma.photo.findMany({
    where: {
      isProcessed: true,
      faceEmbeddings: { none: {} },
    },
    include: {
      uploader: true,
    },
    take: 100, // Process 100 at a time
  });

  console.log(`📸 Processing ${photos.length} photos...`);

  for (const photo of photos) {
    try {
      if (!photo.uploadedBy) continue;

      // Get photo URL
      const photoUrl = `https://drive.google.com/uc?export=view&id=${photo.driveFileId}`;

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

      console.log(`  Found ${detections.length} faces in photo ${photo.id}`);

      if (detections.length === 0) continue;

      // Save to database
      for (const detection of detections) {
        const embedding = Array.from(detection.descriptor);
        const embeddingStr = `[${embedding.join(",")}]`;

        await prisma.$executeRaw`
          INSERT INTO face_embeddings (photo_id, embedding, bounding_box)
          VALUES (
            ${photo.id}::uuid,
            ${embeddingStr}::vector,
            ${JSON.stringify({
              x: detection.detection.box.x,
              y: detection.detection.box.y,
              width: detection.detection.box.width,
              height: detection.detection.box.height,
            })}::jsonb
          )
        `;
      }

      console.log(`  ✅ Saved ${detections.length} face embeddings`);
    } catch (error: any) {
      console.error(`  ❌ Error processing photo ${photo.id}:`, error.message);
    }
  }

  console.log("✅ Done!");
}

extractAllFaces();
