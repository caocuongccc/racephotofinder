// ============================================
// FILE 3: app/api/events/[id]/photos/route.ts
// CẬP NHẬT GET PHOTOS
// ============================================
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/events/[id]/photos - Lấy danh sách photos của event
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const bibNumber = searchParams.get("bib");
    const runnerName = searchParams.get("name");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;
    const params = await context.params;

    let where: any = { eventId: params.id, isProcessed: true };

    // Search by bib number or runner name
    if (bibNumber || runnerName) {
      const runnerWhere: any = { eventId: params.id };

      if (bibNumber) {
        runnerWhere.bibNumber = { contains: bibNumber, mode: "insensitive" };
      }

      if (runnerName) {
        runnerWhere.fullName = { contains: runnerName, mode: "insensitive" };
      }

      // Find runners matching criteria
      const runners = await prisma.runner.findMany({
        where: runnerWhere,
        select: { id: true },
      });

      const runnerIds = runners.map((r) => r.id);

      // Find photos tagged with these runners
      where.tags = {
        some: {
          runnerId: { in: runnerIds },
        },
      };
    }

    const [photos, total] = await Promise.all([
      prisma.photo.findMany({
        where,
        include: {
          tags: {
            include: {
              runner: true,
            },
          },
        },
        orderBy: {
          uploadDate: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.photo.count({ where }),
    ]);

    // Imgbb URLs đã có sẵn trong database, không cần generate
    const photosWithUrls = photos.map((photo) => ({
      ...photo,
      thumbnailUrl: photo.driveThumbnailId, // Imgbb thumbnail URL
      photoUrl: photo.driveFileId, // Imgbb full-size URL
    }));

    return NextResponse.json({
      photos: photosWithUrls,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching photos:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
