// ============================================
// FILE: lib/ocr-google-vision.ts
// ALTERNATIVE: Use Google Vision API for OCR
// ============================================

import { google } from "googleapis";
import prisma from "./prisma";

export interface BibDetection {
  bibNumber: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

/**
 * OCR using Google Vision API
 * Requires: npm install googleapis
 */
export async function detectBibNumbersWithVision(
  imageUrl: string,
  userId: string,
): Promise<BibDetection[]> {
  try {
    console.log("🔍 [Google Vision] Starting OCR...");

    // Get user's Google credentials
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        googleAccessToken: true,
        googleRefreshToken: true,
      },
    });

    if (!user?.googleAccessToken) {
      throw new Error("No Google access token");
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    oauth2Client.setCredentials({
      access_token: user.googleAccessToken,
      refresh_token: user.googleRefreshToken,
    });

    // Create Vision API client
    const vision = google.vision({ version: "v1", auth: oauth2Client });

    // Download image
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Image = buffer.toString("base64");

    console.log("📤 [Google Vision] Sending request...");

    // Call Vision API
    const result = await vision.images.annotate({
      requestBody: {
        requests: [
          {
            image: { content: base64Image },
            features: [
              {
                type: "TEXT_DETECTION",
                maxResults: 50,
              },
            ],
          },
        ],
      },
    });

    console.log("✅ [Google Vision] Response received");

    const detections: BibDetection[] = [];
    const textAnnotations = result.data.responses?.[0]?.textAnnotations || [];

    // Skip first annotation (full text), process individual words
    for (let i = 1; i < textAnnotations.length; i++) {
      const annotation = textAnnotations[i];
      const text = annotation.description?.trim() || "";

      // Look for BIB patterns
      if (/^\d{1,5}$/.test(text)) {
        const vertices = annotation.boundingPoly?.vertices || [];
        if (vertices.length === 4) {
          const x = Math.min(...vertices.map((v) => v.x || 0));
          const y = Math.min(...vertices.map((v) => v.y || 0));
          const maxX = Math.max(...vertices.map((v) => v.x || 0));
          const maxY = Math.max(...vertices.map((v) => v.y || 0));

          detections.push({
            bibNumber: text,
            confidence: 0.9, // Vision API doesn't give confidence per word
            bbox: {
              x,
              y,
              width: maxX - x,
              height: maxY - y,
            },
          });
        }
      }
    }

    console.log(`✅ [Google Vision] Found ${detections.length} BIB numbers`);
    return detections;
  } catch (error: any) {
    console.error("❌ [Google Vision] Error:", error.message);
    return [];
  }
}

/**
 * HYBRID: Try Google Vision first, fallback to Tesseract
 */
export async function detectBibNumbersHybrid(
  imageUrl: string,
  userId: string,
): Promise<BibDetection[]> {
  // Try Google Vision first (more accurate)
  const visionResults = await detectBibNumbersWithVision(imageUrl, userId);

  if (visionResults.length > 0) {
    console.log("✅ Using Google Vision results");
    return visionResults;
  }

  // Fallback to Tesseract
  console.log("⚠️ Vision failed, trying Tesseract...");
  const { detectBibNumbersFast } = await import("./ocr-optimized");
  return await detectBibNumbersFast(imageUrl);
}
