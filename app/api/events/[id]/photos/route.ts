// ============================================
// FILE: app/api/events/[id]/photos/route.ts
// FIX: Generate proper Google Drive URLs for display
// ============================================
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generateDriveUrls } from "@/lib/google-drive-helpers";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const params = await context.params;
    const { searchParams } = new URL(request.url);
    const eventId = params.id;
    // Get event
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    // Parse query params
    //const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "24");
    const runnerId = searchParams.get("runnerId");
    const bibNumber = searchParams.get("bibNumber");

    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      eventId,
      isProcessed: true,
    };

    // Filter by runner
    if (runnerId) {
      where.tags = {
        some: {
          runnerId,
        },
      };
    }

    // Filter by BIB number
    if (bibNumber) {
      where.tags = {
        some: {
          runner: {
            bibNumber,
          },
        },
      };
    }

    // Get photos with tags
    const [photos, total] = await Promise.all([
      prisma.photo.findMany({
        where,
        skip,
        take: limit,
        orderBy: { uploadDate: "desc" },
        include: {
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
      }),
      prisma.photo.count({ where }),
    ]);

    console.log(`📸 Found ${photos.length} photos for event ${eventId}`);

    // ✅ CRITICAL: Generate Google Drive URLs for each photo
    const photosWithUrls = photos.map((photo) => {
      if (!photo.driveFileId || !photo.driveThumbnailId) {
        console.warn(`⚠️ Photo ${photo.id} missing Drive IDs`);
        return {
          ...photo,
          thumbnailUrl: null,
          photoUrl: null,
          downloadUrl: null,
        };
      }

      const urls = generateDriveUrls(
        photo.driveFileId,
        photo.driveThumbnailId,
        photo.id, // ✅ Pass photo ID for proxy
      );

      console.log(`✅ Generated URLs for photo ${photo.id}:`, {
        thumbnail: urls.thumbnailUrl.substring(0, 50) + "...",
        photo: urls.photoUrl.substring(0, 50) + "...",
      });

      return {
        ...photo,
        ...urls,
      };
    });

    return NextResponse.json({
      photos: photosWithUrls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("❌ Error fetching photos:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch photos",
        details: error.message,
      },
      { status: 500 },
    );
  }
}
