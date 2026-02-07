// ============================================
// QUICK DIAGNOSTIC: Check current state
// Run: npx tsx scripts/quick-check.ts
// ============================================

import prisma from "@/lib/prisma";

async function quickCheck() {
  console.log("🔍 QUICK DIAGNOSTIC\n");
  console.log("=".repeat(60));

  // 1. Photos in database
  console.log("\n1️⃣ PHOTOS IN DATABASE");
  const totalPhotos = await prisma.photo.count();
  const processedPhotos = await prisma.photo.count({
    where: { isProcessed: true },
  });

  console.log(`   Total photos: ${totalPhotos}`);
  console.log(`   Processed: ${processedPhotos}`);
  console.log(`   Pending: ${totalPhotos - processedPhotos}`);

  if (processedPhotos === 0) {
    console.log("   ⚠️ No processed photos to display!");
    console.log("   💡 Upload some photos first");
    return;
  }

  // 2. Sample photo URLs
  console.log("\n2️⃣ SAMPLE PHOTO URLS");
  const sample = await prisma.photo.findFirst({
    where: { isProcessed: true },
    select: {
      id: true,
      driveFileId: true,
      driveThumbnailId: true,
      originalFilename: true,
    },
  });

  if (sample) {
    console.log(`   Filename: ${sample.originalFilename}`);
    console.log(`   File ID: ${sample.driveFileId}`);

    const thumbnailUrl = sample.driveThumbnailId
      ? `https://drive.google.com/thumbnail?id=${sample.driveThumbnailId}&sz=w800`
      : `https://drive.google.com/thumbnail?id=${sample.driveFileId}&sz=w800`;

    const photoUrl = `https://drive.google.com/uc?export=view&id=${sample.driveFileId}`;

    console.log(`\n   Thumbnail URL:`);
    console.log(`   ${thumbnailUrl}`);
    console.log(`\n   Photo URL:`);
    console.log(`   ${photoUrl}`);

    console.log(`\n   🧪 TEST: Copy URL above and paste in browser`);
    console.log(`   ✅ If image shows → URLs work`);
    console.log(`   ❌ If 403 error → Files not public`);
  }

  // 3. Events with photos
  console.log("\n3️⃣ EVENTS WITH PHOTOS");
  const eventsWithPhotos = await prisma.event.findMany({
    where: {
      photos: {
        some: {
          isProcessed: true,
        },
      },
    },
    include: {
      _count: {
        select: {
          photos: true,
        },
      },
    },
  });

  for (const event of eventsWithPhotos) {
    console.log(`   ${event.name}: ${event._count.photos} photos`);
    console.log(`     URL: /events/${event.slug}`);
  }

  // 4. Face search readiness
  console.log("\n4️⃣ FACE SEARCH STATUS");
  const faceCount = await prisma.face_embeddings.count();

  if (faceCount === 0) {
    console.log(`   ❌ Not ready (no face data)`);
    console.log(`   💡 Face search will show: "No face data available"`);
  } else {
    console.log(`   ✅ Ready (${faceCount} face embeddings)`);
  }

  // 5. API routes check
  console.log("\n5️⃣ API ROUTES");
  const fs = require("fs");
  const path = require("path");

  const routes = [
    "app/api/events/[id]/photos/route.ts",
    "app/api/events/[id]/search-by-face/route.ts",
    "app/api/photos/[id]/confirm/route.ts",
  ];

  for (const route of routes) {
    const exists = fs.existsSync(path.join(process.cwd(), route));
    console.log(`   ${exists ? "✅" : "❌"} ${route}`);
  }

  // 6. Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 SUMMARY");
  console.log("=".repeat(60));

  if (processedPhotos === 0) {
    console.log("❌ NO PHOTOS - Upload some photos first");
  } else {
    console.log(`✅ ${processedPhotos} photos ready to display`);
    console.log(`\n📝 NEXT STEPS:`);
    console.log(`1. Test URL above in browser`);
    console.log(`2. If 403 → Run: npx tsx scripts/make-all-public.ts`);
    console.log(`3. Open event page and check browser console`);
  }

  console.log("\n");
}

quickCheck()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
