// ============================================
// DIAGNOSTIC: Check Face Search Setup
// Run: npx tsx scripts/check-face-search.ts
// ============================================

import prisma from "@/lib/prisma";

async function checkFaceSearchSetup() {
  console.log("🔍 Checking Face Search Setup...\n");

  // 1. Check vector extension
  console.log("1️⃣ Checking PostgreSQL vector extension...");
  try {
    const result = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;

    if (result.length > 0) {
      console.log("   ✅ Vector extension installed");
    } else {
      console.log("   ❌ Vector extension NOT installed");
      console.log("   💡 Run: CREATE EXTENSION vector;");
      return;
    }
  } catch (error: any) {
    console.log("   ❌ Error checking extension:", error.message);
    return;
  }

  // 2. Check FaceDetection table
  console.log("\n2️⃣ Checking FaceDetection table...");
  try {
    const count = await prisma.faceDetection.count();
    console.log(`   ✅ FaceDetection table exists with ${count} records`);

    if (count === 0) {
      console.log("   ⚠️ No face detections in database");
      console.log("   💡 Need to run face extraction script");
    }
  } catch (error: any) {
    console.log("   ❌ Error:", error.message);
  }

  // 3. Check sample embedding
  console.log("\n3️⃣ Checking embedding format...");
  try {
    const sample = await prisma.$queryRaw<
      Array<{
        id: string;
        embedding: string;
      }>
    >`
      SELECT id, embedding::text 
      FROM face_detections 
      LIMIT 1
    `;

    if (sample.length > 0) {
      const embeddingStr = sample[0].embedding;
      console.log(
        "   ✅ Sample embedding:",
        embeddingStr.substring(0, 50) + "...",
      );

      // Parse to check dimension
      const parsed = JSON.parse(embeddingStr);
      console.log(`   ✅ Dimension: ${parsed.length}D`);
    } else {
      console.log("   ⚠️ No embeddings to check");
    }
  } catch (error: any) {
    console.log("   ❌ Error:", error.message);
  }

  // 4. Test vector similarity query
  console.log("\n4️⃣ Testing vector similarity query...");
  try {
    // Create test vector (128D zeros)
    const testVector = new Array(128).fill(0);
    const vectorStr = `[${testVector.join(",")}]`;

    const result = await prisma.$queryRaw<
      Array<{
        photo_id: string;
        distance: number;
      }>
    >`
      SELECT 
        photo_id,
        embedding <=> ${vectorStr}::vector AS distance
      FROM face_detections
      LIMIT 1
    `;

    if (result.length > 0) {
      console.log("   ✅ Vector query works!");
      console.log(`   Sample distance: ${result[0].distance}`);
    } else {
      console.log("   ⚠️ Query returned no results");
    }
  } catch (error: any) {
    console.log("   ❌ Vector query failed:", error.message);
  }

  // 5. Check photos with face detections
  console.log("\n5️⃣ Checking photos with faces...");
  try {
    const stats = await prisma.$queryRaw<
      Array<{
        event_id: string;
        photo_count: bigint;
        face_count: bigint;
      }>
    >`
      SELECT 
        p.event_id,
        COUNT(DISTINCT p.id) as photo_count,
        COUNT(fd.id) as face_count
      FROM photos p
      LEFT JOIN face_detections fd ON p.id = fd.photo_id
      WHERE p.is_processed = true
      GROUP BY p.event_id
    `;

    if (stats.length > 0) {
      console.log("   ✅ Events with face data:");
      for (const stat of stats) {
        console.log(
          `      Event ${stat.event_id.substring(0, 8)}: ${stat.photo_count} photos, ${stat.face_count} faces`,
        );
      }
    } else {
      console.log("   ⚠️ No photos with face detections");
    }
  } catch (error: any) {
    console.log("   ❌ Error:", error.message);
  }

  // 6. Check API route exists
  console.log("\n6️⃣ Checking API routes...");
  const fs = require("fs");
  const path = require("path");

  const routePath = path.join(
    process.cwd(),
    "app",
    "api",
    "events",
    "[id]",
    "search-by-face",
    "route.ts",
  );

  if (fs.existsSync(routePath)) {
    console.log("   ✅ API route exists:", routePath);
  } else {
    console.log("   ❌ API route NOT found:", routePath);
    console.log("   💡 Copy search-by-face-route.ts to this location");
  }

  // 7. Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 SUMMARY");
  console.log("=".repeat(50));

  const faceCount = await prisma.faceDetection.count();

  if (faceCount === 0) {
    console.log("❌ Face search NOT ready");
    console.log("\n📝 TODO:");
    console.log("1. Run face extraction script");
    console.log("2. Upload some photos");
    console.log("3. Extract faces from photos");
  } else {
    console.log("✅ Face search is ready!");
    console.log(`   ${faceCount} face embeddings in database`);
  }
}

checkFaceSearchSetup()
  .then(() => {
    console.log("\n✅ Check complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Error:", error);
    process.exit(1);
  });
