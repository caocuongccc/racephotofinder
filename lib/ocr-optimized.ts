// ============================================
// FILE: lib/ocr-optimized.ts
// WITH GRACEFUL FALLBACK
// ============================================
import Tesseract from "tesseract.js";
import sharp from "sharp";

export interface BibDetection {
  bibNumber: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
  region?: string;
}

/**
 * OCR WITH GRACEFUL ERROR HANDLING
 */
async function ocrMultipleConfigs(buffer: Buffer): Promise<BibDetection[]> {
  let worker: Tesseract.Worker | null = null;

  try {
    console.log("🔧 Creating Tesseract worker...");

    // ✅ Try to create worker with 3s timeout (faster)
    const workerPromise = Tesseract.createWorker("eng", 1, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          console.log(`  OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      },
    });

    // 3 second timeout for worker creation
    worker = await Promise.race([
      workerPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Worker creation timeout")), 3000),
      ),
    ]);

    console.log("✅ Tesseract worker created");

    const detections: BibDetection[] = [];

    // Config 1: Pure numbers
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789",
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
    });

    let result = await worker.recognize(buffer);

    for (const block of result.data.blocks || []) {
      for (const paragraph of block.paragraphs || []) {
        for (const line of paragraph.lines || []) {
          for (const word of line.words || []) {
            const text = word.text.trim();
            if (/^\d{1,5}$/.test(text) && word.confidence > 70) {
              detections.push({
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

    // Config 2: Alphanumeric
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
    });

    result = await worker.recognize(buffer);

    for (const block of result.data.blocks || []) {
      for (const paragraph of block.paragraphs || []) {
        for (const line of paragraph.lines || []) {
          for (const word of line.words || []) {
            const text = word.text.trim();
            const match = text.match(/^([A-Z]{0,3})(\d{1,5})$/);

            if (match && word.confidence > 70) {
              const exists = detections.some((d) => d.bibNumber === match[0]);
              if (!exists) {
                detections.push({
                  bibNumber: match[0],
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

    return detections;
  } catch (error: any) {
    console.error("❌ OCR error:", error.message);

    // ✅ GRACEFUL: Return empty array instead of throwing
    if (error.message.includes("Cannot find module")) {
      console.error("⚠️ Tesseract worker module not found");
      console.error(
        "💡 Run: npm uninstall tesseract.js && npm install tesseract.js@latest",
      );
    }

    return [];
  } finally {
    if (worker) {
      try {
        await worker.terminate();
        console.log("✅ Worker terminated");
      } catch (err) {
        console.warn("⚠️ Worker termination error:", err);
      }
    }
  }
}

/**
 * FAST VERSION WITH FALLBACK & TIMEOUT
 */
export async function detectBibNumbersFast(
  imageUrl: string,
): Promise<BibDetection[]> {
  try {
    console.log("🔍 Fast BIB detection started...");

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const preprocessed = await sharp(buffer)
      .greyscale()
      .normalize()
      .sharpen({ sigma: 1.5 })
      .threshold(128)
      .toBuffer();

    const metadata = await sharp(preprocessed).metadata();
    const w = metadata.width;
    const h = metadata.height;

    if (!w || !h) {
      throw new Error("Invalid image dimensions");
    }

    const cropped = await sharp(preprocessed)
      .extract({
        left: Math.floor(w * 0.3),
        top: Math.floor(h * 0.15),
        width: Math.floor(w * 0.4),
        height: Math.floor(h * 0.35),
      })
      .toBuffer();

    // ✅ Add 10s timeout to entire OCR operation
    const detections = await Promise.race([
      ocrMultipleConfigs(cropped),
      new Promise<BibDetection[]>((resolve) =>
        setTimeout(() => {
          console.log("⚠️ OCR timeout (10s), returning empty");
          resolve([]);
        }, 10000),
      ),
    ]);

    console.log(`✅ Fast detection found ${detections.length} BIBs`);
    return detections;
  } catch (error: any) {
    console.error("❌ Fast detection error:", error.message);

    // ✅ GRACEFUL: Return empty instead of throwing
    return [];
  }
}

/**
 * CHECK IF OCR IS AVAILABLE (FAST - 1s timeout)
 */
export async function isOcrAvailable(): Promise<boolean> {
  try {
    const worker = await Promise.race([
      Tesseract.createWorker("eng"),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 1000),
      ),
    ]);

    await worker.terminate();
    return true;
  } catch (error) {
    console.error("❌ OCR not available:", error);
    return false;
  }
}

export function isValidBibNumber(bib: string): boolean {
  return /^[A-Z]{0,5}\d{1,5}$/.test(bib);
}

export function cleanBibNumber(bib: string): string {
  return bib
    .toUpperCase()
    .replace(/O/g, "0")
    .replace(/I/g, "1")
    .replace(/S/g, "5")
    .replace(/Z/g, "2")
    .replace(/[^A-Z0-9]/g, "");
}
