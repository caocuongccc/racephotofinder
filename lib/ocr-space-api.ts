// ============================================
// FILE: lib/ocr-space-api.ts
// ALTERNATIVE: Use OCR.space Free API
// Sign up: https://ocr.space/ocrapi
// Free tier: 25,000 requests/month
// ============================================

export interface BibDetection {
  bibNumber: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

/**
 * OCR using OCR.space API (Free tier available)
 * Get API key: https://ocr.space/ocrapi
 */
export async function detectBibNumbersWithOCRSpace(
  imageUrl: string,
): Promise<BibDetection[]> {
  try {
    console.log("🔍 [OCR.space] Starting OCR...");

    const apiKey = process.env.OCR_SPACE_API_KEY;
    if (!apiKey) {
      throw new Error("OCR_SPACE_API_KEY not set in .env");
    }

    // Call OCR.space API
    const formData = new FormData();
    formData.append("url", imageUrl);
    formData.append("apikey", apiKey);
    formData.append("language", "eng");
    formData.append("isOverlayRequired", "true"); // Get word positions
    formData.append("detectOrientation", "true");
    formData.append("scale", "true");
    formData.append("OCREngine", "2"); // Engine 2 is better for numbers

    console.log("📤 [OCR.space] Sending request...");

    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    if (!result.IsErroredOnProcessing && result.ParsedResults?.length > 0) {
      console.log("✅ [OCR.space] Response received");

      const detections: BibDetection[] = [];
      const parsedText = result.ParsedResults[0];

      // Get full text
      const fullText = parsedText.ParsedText || "";

      // Extract numbers from text
      const lines = fullText.split("\n");

      for (const line of lines) {
        const numbers = line.match(/\b\d{1,5}\b/g);
        if (numbers) {
          for (const num of numbers) {
            // OCR.space free tier doesn't give exact positions
            // Use 0.85 confidence as default
            detections.push({
              bibNumber: num,
              confidence: 0.85,
              bbox: { x: 0, y: 0, width: 0, height: 0 },
            });
          }
        }
      }

      // Remove duplicates
      const unique = Array.from(
        new Map(detections.map((d) => [d.bibNumber, d])).values(),
      );

      console.log(`✅ [OCR.space] Found ${unique.length} BIB numbers`);
      return unique;
    } else {
      console.error("❌ [OCR.space] Error:", result.ErrorMessage);
      return [];
    }
  } catch (error: any) {
    console.error("❌ [OCR.space] Error:", error.message);
    return [];
  }
}

/**
 * MULTI-ENGINE: Try all OCR engines
 */
export async function detectBibNumbersMultiEngine(
  imageUrl: string,
  userId?: string,
): Promise<BibDetection[]> {
  const results: BibDetection[] = [];

  // 1. Try OCR.space (Fast, Free, Reliable)
  console.log("🔍 Trying OCR.space...");
  const ocrSpaceResults = await detectBibNumbersWithOCRSpace(imageUrl);
  results.push(...ocrSpaceResults);

  // 2. If no results, try Google Vision (if userId provided)
  if (results.length === 0 && userId) {
    console.log("🔍 Trying Google Vision...");
    const { detectBibNumbersWithVision } = await import("./ocr-google-vision");
    const visionResults = await detectBibNumbersWithVision(imageUrl, userId);
    results.push(...visionResults);
  }

  // 3. If still no results, try Tesseract
  if (results.length === 0) {
    console.log("🔍 Trying Tesseract (last resort)...");
    try {
      const { detectBibNumbersFast } = await import("./ocr-optimized");
      const tesseractResults = await detectBibNumbersFast(imageUrl);
      results.push(...tesseractResults);
    } catch (err) {
      console.error("❌ Tesseract failed:", err);
    }
  }

  // Remove duplicates
  const unique = Array.from(
    new Map(results.map((d) => [d.bibNumber, d])).values(),
  );

  return unique;
}
