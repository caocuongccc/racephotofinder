// ============================================
// DEBUG: Check face detection data
// Run: node debug-face-search.js
// ============================================

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function debugFaceSearch() {
  console.log("🔍 Debugging Face Search...\n");

  // Check 1: Do we have any face detections?
  const faceCount = await prisma.faceDetection.count();
  console.log(`1️⃣ Face detections in database: ${faceCount}`);

  if (faceCount === 0) {
    console.log("   ❌ No face detections found!");
    console.log("   💡 Face detection needs to run on photos first\n");
  } else {
    // Sample face detection
    const sample = await prisma.faceDetection.findFirst({
      include: {
        photo: {
          select: {
            id: true,
            originalFilename: true,
          },
        },
      },
    });

    console.log("   ✅ Sample face detection:");
    console.log(`      Photo: ${sample?.photo.originalFilename}`);
    console.log(`      Embedding: ${sample?.embedding ? "Present" : "Missing"}`);
    console.log(`      Confidence: ${sample?.confidence}\n`);
  }

  // Check 2: Do we have photos?
  const photoCount = await prisma.photo.count({
    where: { isProcessed: true },
  });
  console.log(`2️⃣ Processed photos: ${photoCount}`);

  if (photoCount === 0) {
    console.log("   ❌ No processed photos!\n");
  } else {
    // Sample photo with face detection status
    const photosWithFaces = await prisma.photo.findMany({
      take: 5,
      where: { isProcessed: true },
      include: {
        _count: {
          select: {
            faceDetections: true,
          },
        },
      },
    });

    console.log("   Sample photos:");
    photosWithFaces.forEach((p) => {
      console.log(
        `      ${p.originalFilename}: ${p._count.faceDetections} faces`,
      );
    });
    console.log("");
  }

  // Check 3: Face detection model status
  console.log("3️⃣ Checking face detection setup...");

  try {
    const { default: faceapi } = await import("face-api.js");
    console.log("   ✅ face-api.js installed");

    // Check if models are loaded
    const modelsPath = "./public/models";
    const fs = await import("fs");

    if (fs.existsSync(modelsPath)) {
      const files = fs.readdirSync(modelsPath);
      console.log(`   ✅ Model files found: ${files.length}`);
      console.log(`      Files: ${files.join(", ")}`);
    } else {
      console.log("   ❌ Models directory not found");
      console.log("      Expected: ./public/models");
    }
  } catch (err: any) {
    console.log(`   ❌ face-api.js not installed: ${err.message}`);
    console.log("      Run: npm install face-api.js canvas");
  }

  console.log("");

  // Check 4: Search by face API endpoint
  console.log("4️⃣ Checking API endpoint...");

  const fs = await import("fs");
  const routePath = "./app/api/events/[id]/search-by-face/route.ts";

  if (fs.existsSync(routePath)) {
    console.log("   ✅ Search by face route exists");

    const content = fs.readFileSync(routePath, "utf-8");

    if (content.includes("faceapi")) {
      console.log("   ✅ Uses face-api.js");
    } else {
      console.log("   ⚠️ Might not use face-api.js");
    }

    if (content.includes("generateDriveUrls")) {
      console.log("   ✅ Generates Drive URLs");
    } else {
      console.log("   ❌ Missing Drive URL generation");
    }
  } else {
    console.log("   ❌ Search by face route not found");
  }

  console.log("");

  // Summary
  console.log("📊 SUMMARY:");
  console.log("─────────────────────────────────────");

  if (faceCount === 0) {
    console.log("❌ ISSUE 1: No face detections");
    console.log("   → Need to run face detection on uploaded photos");
    console.log("   → Check if face detection runs after upload\n");
  }

  if (photoCount === 0) {
    console.log("❌ ISSUE 2: No photos uploaded");
    console.log("   → Upload some photos first\n");
  }

  console.log("💡 NEXT STEPS:");
  console.log("1. Upload photos");
  console.log("2. Check if face detection runs automatically");
  console.log("3. If not, implement face detection job");
  console.log("4. Test search by face with sample photo");

  await prisma.$disconnect();
}

debugFaceSearch().catch(console.error);