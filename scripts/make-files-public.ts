// scripts/make-files-public.ts
import prisma from "@/lib/prisma";
import { ensurePublicAccess } from "@/lib/google-drive-helpers";

async function makeAllFilesPublic() {
  const photos = await prisma.photo.findMany({
    where: { isProcessed: true },
    include: { uploader: true },
  });

  for (const photo of photos) {
    try {
      if (photo.uploadedBy) {
        await ensurePublicAccess(photo.uploadedBy, photo.driveFileId);
        if (photo.driveThumbnailId) {
          await ensurePublicAccess(photo.uploadedBy, photo.driveThumbnailId);
        }
        console.log(`✅ Made photo ${photo.id} public`);
      }
    } catch (error) {
      console.error(`❌ Failed for photo ${photo.id}:`, error);
    }
  }
}

makeAllFilesPublic();
