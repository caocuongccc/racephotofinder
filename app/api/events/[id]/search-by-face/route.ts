// ============================================
// FILE: app/api/events/[id]/search-by-face/route.ts
// FIXED: Use correct Prisma model name
// ============================================
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateDriveUrls } from "@/lib/google-drive-helpers";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const params = await context.params;

  try {
    console.log("🔍 Face search request for event:", params.id);

    const body = await request.json();
    console.log("✅ Received face search request body", body);
    const { embedding } = body;

    // Validate input
    if (!embedding || !Array.isArray(embedding)) {
      return NextResponse.json(
        {
          error: "Invalid embedding format",
          expected: "Array of numbers",
          received: typeof embedding,
        },
        { status: 400 },
      );
    }

    if (embedding.length !== 128 && embedding.length !== 512) {
      return NextResponse.json(
        {
          error: "Invalid embedding dimension",
          expected: "128 or 512",
          received: embedding.length,
        },
        { status: 400 },
      );
    }

    console.log(`✅ Received ${embedding.length}D face descriptor`);

    // Check if event exists
    const event = await prisma.event.findUnique({
      where: { id: params.id },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    console.log("✅ Event found:", event.name);

    // ⚠️ FIX: Check all possible model names
    let faceCount = 0;
    let modelName = "";

    try {
      // Try FaceDetection (PascalCase)
      faceCount = await prisma.faceEmbedding.count({
        where: {
          photo: {
            eventId: params.id,
            isProcessed: true,
          },
        },
      });
      console.log("✅ Found face embeddings using FaceEmbedding model");
      modelName = "faceEmbedding";
    } catch (e1) {
      console.error("❌ FaceEmbedding model not found in schema");

      return NextResponse.json({
        success: true,
        photos: [],
        total: 0,
        error: "Face search not available",
        message:
          "Face detection feature is not configured. Please use BIB number search instead.",
        debug: {
          tried: ["faceDetection", "faceDetections", "face_detections"],
          suggestion: "Add FaceDetection model to schema.prisma",
        },
      });
    }

    console.log(
      `📊 Using model: ${modelName}, found ${faceCount} face detections`,
    );

    if (faceCount === 0) {
      return NextResponse.json({
        success: true,
        photos: [],
        total: 0,
        message:
          "No face data available for this event. Photos need face detection to be run first.",
      });
    }

    // Convert embedding to PostgreSQL vector format
    const embeddingStr = `[${embedding.join(",")}]`;
    const threshold = 0.7;

    console.log("🔍 Searching for similar faces...");

    let results;

    try {
      // Use raw SQL to avoid model name issues
      results = await prisma.$queryRaw<
        Array<{
          photo_id: string;
          distance: number;
          confidence: number;
          bounding_box: any;
        }>
      >`
        SELECT 
          fd.photo_id,
          fd.embedding <=> ${embeddingStr}::vector AS distance,
           (1 - (fd.embedding <=> ${embeddingStr}::vector)) AS confidence,
          fd.bounding_box
        FROM face_embeddings fd
        INNER JOIN photos p ON fd.photo_id = p.id
        WHERE p.event_id = ${params.id}::uuid
          AND p.is_processed = true
          AND fd.embedding <=> ${embeddingStr}::vector < ${threshold}
        ORDER BY distance ASC
        LIMIT 50
      `;

      console.log(`✅ Vector search returned ${results.length} matches`);
    } catch (vectorError: any) {
      console.error("❌ Vector search error:", vectorError.message);

      if (
        vectorError.message.includes("operator does not exist") ||
        vectorError.message.includes('type "vector" does not exist')
      ) {
        return NextResponse.json({
          success: true,
          photos: [],
          total: 0,
          error: "Vector extension not installed",
          message: "Face search requires PostgreSQL pgvector extension.",
          solution: "Run in database: CREATE EXTENSION IF NOT EXISTS vector;",
        });
      }

      if (
        vectorError.message.includes(
          'relation "face_detections" does not exist',
        )
      ) {
        return NextResponse.json({
          success: true,
          photos: [],
          total: 0,
          error: "Face detection table not found",
          message:
            "Face detection feature is not set up. Please use BIB number search instead.",
        });
      }

      throw vectorError;
    }

    if (results.length === 0) {
      return NextResponse.json({
        success: true,
        photos: [],
        total: 0,
        message: "No matching faces found. Try uploading a clearer photo.",
        searched: faceCount,
      });
    }

    // Get unique photo IDs
    const photoIds = [...new Set(results.map((r) => r.photo_id))];
    // Get photo details
    const photos = await prisma.photo.findMany({
      where: {
        id: { in: photoIds },
      },
      include: {
        tags: {
          include: {
            runner: true,
          },
        },
      },
    });
    // Generate URLs and add similarity scores
    const photosWithUrls = photos.map((photo) => {
      const photoMatches = results.filter((r) => r.photo_id === photo.id);
      const bestMatch = photoMatches.reduce((best, current) =>
        current.distance < best.distance ? current : best,
      );

      const urls = generateDriveUrls(photo.driveFileId, photo.driveThumbnailId);

      const similarity = Math.round(
        Math.max(0, Math.min(100, (1 - bestMatch.distance / threshold) * 100)),
      );

      return {
        ...photo,
        ...urls,
        similarity,
        faceDistance: bestMatch.distance,
        detectionConfidence: bestMatch.confidence,
      };
    });

    photosWithUrls.sort((a, b) => b.similarity - a.similarity);

    console.log("✅ Face search complete:", {
      matched: photosWithUrls.length,
      topSimilarity: photosWithUrls[0]?.similarity || 0,
    });

    return NextResponse.json({
      success: true,
      photos: photosWithUrls,
      total: photosWithUrls.length,
      stats: {
        threshold,
        searched: faceCount,
        matched: photosWithUrls.length,
      },
    });
  } catch (error: any) {
    console.error("❌ Face search error:", error);

    return NextResponse.json(
      {
        error: "Face search failed",
        message: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 },
    );
  }
}
