// scripts/check-photos.ts
import prisma from "@/lib/prisma";

async function checkPhotos() {
  const photos = await prisma.photo.findMany({
    where: { isProcessed: true },
    select: {
      id: true,
      driveFileId: true,
      driveThumbnailId: true,
      originalFilename: true,
      event: { select: { name: true } },
    },
    take: 5,
  });

  console.log(`📸 Found ${photos.length} processed photos:\n`);

  for (const photo of photos) {
    console.log(`Photo: ${photo.originalFilename}`);
    console.log(`  Event: ${photo.event.name}`);
    console.log(`  File ID: ${photo.driveFileId}`);
    console.log(`  Thumbnail ID: ${photo.driveThumbnailId || "N/A"}`);

    // Generate URLs
    const photoUrl = `https://drive.google.com/uc?export=view&id=${photo.driveFileId}`;
    const thumbnailUrl = photo.driveThumbnailId
      ? `https://drive.google.com/thumbnail?id=${photo.driveThumbnailId}&sz=w800`
      : `https://drive.google.com/thumbnail?id=${photo.driveFileId}&sz=w800`;

    console.log(`  Photo URL: ${photoUrl}`);
    console.log(`  Thumbnail URL: ${thumbnailUrl}\n`);
  }
}

checkPhotos();
