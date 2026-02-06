// ============================================
// FILE: lib/ocr.ts - FIX FOR TESSERACT V5
// ============================================
import { createWorker } from "tesseract.js";
import sharp from "sharp";

/**
 * Pre-process ảnh để OCR tốt hơn
 */
async function preprocessImage(buffer: Buffer): Promise<Buffer> {
  return await sharp(buffer)
    .greyscale()
    .normalize()
    .threshold(128)
    .sharpen()
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
 * Extract BIB numbers from image - FIXED FOR TESSERACT V5
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

    // ✅ FIXED: Traverse through blocks → paragraphs → lines → words
    if (data.blocks && data.blocks.length > 0) {
      for (const block of data.blocks) {
        for (const paragraph of block.paragraphs || []) {
          for (const line of paragraph.lines || []) {
            const lineText = line.text.trim();

            // Look for patterns that match BIB numbers (1-5 digits)
            const matches = lineText.match(/\b\d{1,5}\b/g);

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

            // Also check individual words for better accuracy
            for (const word of line.words || []) {
              const text = word.text.trim();
              if (/^\d{1,5}$/.test(text)) {
                const num = parseInt(text);
                if (num >= 1 && num <= 99999) {
                  // Check if not already added
                  const exists = bibNumbers.some(
                    (b) =>
                      b.bibNumber === text &&
                      Math.abs(b.bbox.x - word.bbox.x0) < 10,
                  );

                  if (!exists) {
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
              }
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
    return [];
  } finally {
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
 * Extract BIB numbers với preprocessing - FIXED FOR TESSERACT V5
 */
export async function extractBibNumbersImproved(
  imageUrl: string,
): Promise<BibDetection[]> {
  let worker = null;

  try {
    // Download image
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Preprocess
    const processedBuffer = await preprocessImage(buffer);

    // Create worker
    worker = await createWorker("eng");

    // OCR with better config
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789",
      tessedit_pageseg_mode: 11, // PSM.SPARSE_TEXT
    });

    const result = await worker.recognize(processedBuffer);

    const bibNumbers: BibDetection[] = [];

    // ✅ FIXED: Traverse structure
    for (const block of result.data.blocks || []) {
      for (const paragraph of block.paragraphs || []) {
        for (const line of paragraph.lines || []) {
          for (const word of line.words || []) {
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
        }
      }
    }

    // Sort by confidence
    return bibNumbers.sort((a, b) => b.confidence - a.confidence);
  } catch (error) {
    console.error("OCR error:", error);
    return [];
  } finally {
    if (worker) {
      await worker.terminate();
    }
  }
}

/**
 * Detect BIB locations in image
 */
export async function detectBibRegions(
  buffer: Buffer,
): Promise<{ left: number; top: number; width: number; height: number }[]> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width;
  const height = metadata.height;

  if (!width || !height) {
    throw new Error("Invalid image dimensions");
  }

  const regions = [
    // Center chest
    {
      left: Math.floor(width * 0.3),
      top: Math.floor(height * 0.2),
      width: Math.floor(width * 0.4),
      height: Math.floor(height * 0.3),
    },
    // Left chest
    {
      left: Math.floor(width * 0.2),
      top: Math.floor(height * 0.2),
      width: Math.floor(width * 0.3),
      height: Math.floor(height * 0.3),
    },
    // Right chest
    {
      left: Math.floor(width * 0.5),
      top: Math.floor(height * 0.2),
      width: Math.floor(width * 0.3),
      height: Math.floor(height * 0.3),
    },
  ];

  return regions;
}

/**
 * Multi-region OCR - FIXED FOR TESSERACT V5
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
      detection.bbox.x += region.left;
      detection.bbox.y += region.top;
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
