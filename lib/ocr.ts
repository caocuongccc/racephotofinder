// ============================================
// FILE: lib/ocr.ts - CẬP NHẬT
// ============================================
// OCR service to extract BIB numbers from photos
import { createWorker } from "tesseract.js";

export interface BibDetection {
  bibNumber: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Extract BIB numbers from image
 */
export async function extractBibNumbers(
  imageUrl: string
): Promise<BibDetection[]> {
  let worker = null;

  try {
    console.log("🔍 Starting OCR for:", imageUrl);

    // Create worker with explicit config
    worker = await createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
      workerPath:
        typeof window !== "undefined"
          ? "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js"
          : undefined,
      corePath:
        typeof window !== "undefined"
          ? "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js"
          : undefined,
    });

    console.log("✅ OCR Worker initialized");

    // Recognize text
    const { data } = await worker.recognize(imageUrl);

    console.log("✅ OCR Complete. Processing results...");

    const bibNumbers: BibDetection[] = [];

    // Process lines
    if (data.lines && data.lines.length > 0) {
      for (const line of data.lines) {
        const text = line.text.trim();

        // Look for patterns that match BIB numbers (1-5 digits)
        const matches = text.match(/\b\d{1,5}\b/g);

        if (matches) {
          for (const match of matches) {
            // Filter out obvious non-BIB numbers
            const num = parseInt(match);
            if (num >= 1 && num <= 99999) {
              bibNumbers.push({
                bibNumber: match,
                confidence: line.confidence / 100,
                bbox: {
                  x: line.bbox.x0,
                  y: line.bbox.y0,
                  width: line.bbox.x1 - line.bbox.x0,
                  height: line.bbox.y1 - line.bbox.y0,
                },
              });
            }
          }
        }
      }
    }

    console.log(`✅ Found ${bibNumbers.length} potential BIB numbers`);

    // Filter by confidence > 60%
    const filtered = bibNumbers.filter((bib) => bib.confidence > 0.6);

    console.log(
      `✅ Filtered to ${filtered.length} high-confidence BIB numbers`
    );

    return filtered;
  } catch (error: any) {
    console.error("❌ OCR error:", error.message);

    // Return empty array instead of throwing
    // This allows the upload to complete even if OCR fails
    return [];
  } finally {
    // Always terminate worker to free memory
    if (worker) {
      try {
        await worker.terminate();
        console.log("✅ OCR Worker terminated");
      } catch (err) {
        console.error("⚠️ Error terminating worker:", err);
      }
    }
  }
}

/**
 * Process image and auto-tag with detected BIB numbers
 */
export async function autoTagPhoto(
  photoUrl: string,
  eventId: string
): Promise<{ bibNumbers: string[]; confidence: number }> {
  const detections = await extractBibNumbers(photoUrl);

  if (detections.length === 0) {
    return { bibNumbers: [], confidence: 0 };
  }

  // Calculate average confidence
  const avgConfidence =
    detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length;

  return {
    bibNumbers: detections.map((d) => d.bibNumber),
    confidence: avgConfidence,
  };
}
