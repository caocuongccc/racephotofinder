import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDownloadUrl, getDownloadUrl } from "@/lib/google-drive-oauth";
import { extractBibNumbers } from "@/lib/ocr";

// POST /api/photos/batch-process - Batch process photos (OCR + Face detection)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { eventId, processType = "ocr" } = body; // 'ocr' or 'faces'

    if (!eventId) {
      return NextResponse.json(
        { error: "Event ID is required" },
        { status: 400 },
      );
    }

    // Get unprocessed photos
    const photos = await prisma.photo.findMany({
      where: {
        eventId,
        isProcessed: true,
        // Only get photos without tags
        tags: {
          none: {},
        },
      },
      take: 50, // Process max 50 photos at a time
    });

    if (photos.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No photos to process",
      });
    }

    let processedCount = 0;
    const results: any[] = [];

    for (const photo of photos) {
      try {
        if (processType === "ocr") {
          // Get photo URL
          const photoUrl = await getDownloadUrl("", photo.driveFileId);

          // Extract BIB numbers
          const detections = await extractBibNumbers(photoUrl);

          if (detections.length > 0) {
            // Find matching runners
            const runners = await prisma.runner.findMany({
              where: {
                eventId: photo.eventId,
                bibNumber: {
                  in: detections.map((d) => d.bibNumber),
                },
              },
            });

            if (runners.length > 0) {
              // Create tags
              await prisma.photoTag.createMany({
                data: runners.map((runner) => {
                  const detection = detections.find(
                    (d) => d.bibNumber === runner.bibNumber,
                  );
                  return {
                    photoId: photo.id,
                    runnerId: runner.id,
                    confidence: detection?.confidence || 0.5,
                    taggedBy: session.user.id,
                  };
                }),
              });

              processedCount++;
              results.push({
                photoId: photo.id,
                bibNumbers: detections.map((d) => d.bibNumber),
                tagged: runners.length,
              });
            }
          }
        }

        // Small delay to avoid overloading
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error processing photo ${photo.id}:`, error);
        results.push({
          photoId: photo.id,
          error: "Processing failed",
        });
      }
    }

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        action: "batch_process_photos",
        entityType: "event",
        entityId: eventId,
        metadata: {
          processType,
          totalPhotos: photos.length,
          processed: processedCount,
        },
      },
    });

    return NextResponse.json({
      success: true,
      totalPhotos: photos.length,
      processed: processedCount,
      results,
    });
  } catch (error) {
    console.error("Batch process error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
