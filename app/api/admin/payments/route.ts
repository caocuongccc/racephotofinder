// ============================================
// FILE 5: app/api/admin/payments/route.ts
// CẬP NHẬT GET PAYMENTS (remove getThumbnailUrl)
// ============================================
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";

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
            driveThumbnailId: true, // Imgbb URL
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Imgbb URLs đã có sẵn, không cần generate
    const paymentsWithUrls = payments.map((payment) => ({
      ...payment,
      photo: payment.photo
        ? {
            ...payment.photo,
            thumbnailUrl: payment.photo.driveThumbnailId, // Imgbb URL
          }
        : null,
    }));

    return NextResponse.json(paymentsWithUrls);
  } catch (error) {
    console.error("Error fetching payments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
