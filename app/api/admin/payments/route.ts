// ============================================
// FILE: app/api/admin/payments/route.ts
// FIX: Generate proper Google Drive URLs for payments
// ============================================
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

// Helper function to generate Google Drive URLs
function generateDriveUrls(fileId: string, thumbnailId: string | null) {
  return {
    photoUrl: `https://drive.google.com/uc?export=download&id=${fileId}`,
    thumbnailUrl: thumbnailId
      ? `https://drive.google.com/thumbnail?id=${thumbnailId}&sz=w400`
      : `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`,
  };
}

// GET /api/admin/payments
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (
      !session ||
      (session.user.role !== "admin" && session.user.role !== "uploader")
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const where: any = {};
    if (status && status !== "all") {
      where.status = status;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        paymentConfig: {
          include: {
            event: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        },
        photo: {
          select: {
            id: true,
            driveFileId: true,
            driveThumbnailId: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Generate Google Drive URLs
    const paymentsWithUrls = payments.map((payment) => ({
      ...payment,
      photo: payment.photo
        ? {
            ...payment.photo,
            thumbnailUrl: generateDriveUrls(
              payment.photo.driveFileId,
              payment.photo.driveThumbnailId,
            ).thumbnailUrl,
          }
        : null,
    }));

    return NextResponse.json(paymentsWithUrls);
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
