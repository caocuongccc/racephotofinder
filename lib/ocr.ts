// ============================================
// FILE: lib/ocr.ts - CẬP NHẬT
// ============================================
// OCR service to extract BIB numbers from photos
import { createWorker } from "tesseract.js";
import sharp from "sharp";

/**
 * Pre-process ảnh để OCR tốt hơn
 */
async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return await sharp(buffer)
    .greyscale() // Convert to grayscale
    .normalize() // Normalize contrast
    .threshold(128) // Binary threshold
    .sharpen() // Sharpen edges
    .toBuffer();
}

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
  imageUrl: string,
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
      `✅ Filtered to ${filtered.length} high-confidence BIB numbers`,
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
  eventId: string,
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

/**
 * Extract BIB numbers với preprocessing
 */
export async function extractBibNumbersImproved(
  imageUrl: string,
): Promise<BibDetection[]> {
  try {
    // Download image
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Preprocess
    const processedBuffer = await preprocessImage(buffer);

    // OCR with better config
    const result = await Tesseract.recognize(processedBuffer, "eng", {
      logger: (m) => console.log(m),
      tessedit_char_whitelist: "0123456789", // Only digits
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
    });

    const bibNumbers: BibDetection[] = [];

    // Extract numbers
    for (const word of result.data.words) {
      const text = word.text.trim();

      // BIB numbers are typically 1-5 digits
      if (/^\d{1,5}$/.test(text) && word.confidence > 70) {
        bibNumbers.push({
          bibNumber: text,
          confidence: word.confidence / 100,
          bbox: {
            x: word.bbox.x0,
            y: word.bbox.y0,
            width: word.bbox.x1 - word.bbox.x0,
            height: word.bbox.y1 - word.bbox.y0,
          },
        });
      }
    }

    // Sort by confidence
    return bibNumbers.sort((a, b) => b.confidence - a.confidence);
  } catch (error) {
    console.error("OCR error:", error);
    return [];
  }
}

/**
 * Detect BIB locations in image
 */
export async function detectBibRegions(
  buffer: Buffer,
): Promise<{ x: number; y: number; width: number; height: number }[]> {
  // Crop common BIB regions (chest area)
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  const regions = [
    // Center chest
    {
      x: Math.floor(width * 0.3),
      y: Math.floor(height * 0.2),
      width: Math.floor(width * 0.4),
      height: Math.floor(height * 0.3),
    },
    // Left chest
    {
      x: Math.floor(width * 0.2),
      y: Math.floor(height * 0.2),
      width: Math.floor(width * 0.3),
      height: Math.floor(height * 0.3),
    },
    // Right chest
    {
      x: Math.floor(width * 0.5),
      y: Math.floor(height * 0.2),
      width: Math.floor(width * 0.3),
      height: Math.floor(height * 0.3),
    },
  ];

  return regions;
}

/**
 * Multi-region OCR
 */
export async function multiRegionOCR(
  imageUrl: string,
): Promise<BibDetection[]> {
  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const regions = await detectBibRegions(buffer);
  const allDetections: BibDetection[] = [];

  for (const region of regions) {
    const croppedBuffer = await sharp(buffer).extract(region).toBuffer();

    const detections = await extractBibNumbersImproved(
      `data:image/jpeg;base64,${croppedBuffer.toString("base64")}`,
    );

    // Adjust bbox to original image coordinates
    for (const detection of detections) {
      detection.bbox.x += region.x;
      detection.bbox.y += region.y;
      allDetections.push(detection);
    }
  }

  // Remove duplicates
  const unique = new Map<string, BibDetection>();
  for (const detection of allDetections) {
    const existing = unique.get(detection.bibNumber);
    if (!existing || detection.confidence > existing.confidence) {
      unique.set(detection.bibNumber, detection);
    }
  }

  return Array.from(unique.values());
}
