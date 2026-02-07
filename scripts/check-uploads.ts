// scripts/check-uploads.ts
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
}
console.log("📸 Recent uploads:");
for (const photo of photos) {
  console.log(`  ${photo.originalFilename}`);
  console.log(`    File ID: ${photo.driveFileId}`);
  console.log(
    `    URL: https://drive.google.com/file/d/${photo.driveFileId}/view`,
  );
}
