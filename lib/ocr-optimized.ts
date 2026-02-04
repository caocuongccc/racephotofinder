// ============================================
// FILE: lib/ocr-optimized.ts
// OPTIMIZED OCR for blurry/skewed race photos
// Handles: blur, noise, skew, low contrast, uneven lighting
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
 * ADVANCED PREPROCESSING
 * Tạo nhiều phiên bản preprocessing để tăng tỷ lệ detect
 */
async function advancedPreprocess(buffer: Buffer): Promise<Buffer[]> {
  const versions: Buffer[] = [];

  // Version 1: Standard (cho ảnh normal)
  versions.push(
    await sharp(buffer)
      .greyscale()
      .normalize()
      .sharpen({ sigma: 1.5 })
      .threshold(128)
      .toBuffer(),
  );

  // Version 2: High contrast (cho ảnh mờ/nhạt)
  versions.push(
    await sharp(buffer)
      .greyscale()
      .normalize()
      .linear(1.5, -64) // Tăng contrast mạnh
      .sharpen({ sigma: 2 })
      .threshold(100)
      .toBuffer(),
  );

  // Version 3: Denoise (cho ảnh nhiễu)
  versions.push(
    await sharp(buffer)
      .greyscale()
      .median(3) // Lọc nhiễu
      .normalize()
      .sharpen({ sigma: 2 })
      .threshold(128)
      .toBuffer(),
  );

  // Version 4: Adaptive threshold (cho ánh sáng không đều)
  versions.push(
    await sharp(buffer)
      .greyscale()
      .normalize()
      .sharpen({ sigma: 2 })
      .linear(1.2, -(128 * 0.2))
      .toBuffer(),
  );

  return versions;
}

/**
 * DESKEW IMAGE
 * Xoay ảnh nghiêng về thẳng
 */
async function deskewImage(buffer: Buffer): Promise<Buffer[]> {
  const angles = [-15, -10, -5, 0, 5, 10, 15];
  const deskewed: Buffer[] = [];

  for (const angle of angles) {
    try {
      const rotated = await sharp(buffer)
        .rotate(angle, { background: { r: 255, g: 255, b: 255 } })
        .toBuffer();
      deskewed.push(rotated);
    } catch (err) {
      console.warn(`Rotate ${angle}° failed:`, err);
    }
  }

  return deskewed;
}

/**
 * DETECT BIB REGIONS
 * Các vùng thường có BIB
 */
async function detectBibRegions(buffer: Buffer) {
  const { width: w, height: h } = await sharp(buffer).metadata();

  return [
    {
      name: "center_chest",
      x: w! * 0.3,
      y: h! * 0.15,
      width: w! * 0.4,
      height: h! * 0.35,
    },
    {
      name: "left_chest",
      x: w! * 0.15,
      y: h! * 0.15,
      width: w! * 0.3,
      height: h! * 0.35,
    },
    {
      name: "right_chest",
      x: w! * 0.55,
      y: h! * 0.15,
      width: w! * 0.3,
      height: h! * 0.35,
    },
    {
      name: "upper_body",
      x: w! * 0.2,
      y: h! * 0.1,
      width: w! * 0.6,
      height: h! * 0.5,
    },
  ].map((r) => ({
    ...r,
    x: Math.floor(r.x),
    y: Math.floor(r.y),
    width: Math.floor(r.width),
    height: Math.floor(r.height),
  }));
}

/**
 * OCR WITH MULTIPLE CONFIGS
 */
async function ocrMultipleConfigs(buffer: Buffer): Promise<BibDetection[]> {
  let worker: Tesseract.Worker | null = null;

  try {
    worker = await Tesseract.createWorker("eng");
    const detections: BibDetection[] = [];

    // Config 1: Pure numbers
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789",
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
    });

    let result = await worker.recognize(buffer);
    for (const word of result.data.words) {
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

    // Config 2: Alphanumeric (A123, VIP456)
    await worker.setParameters({
      tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",
      tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
    });

    result = await worker.recognize(buffer);
    for (const word of result.data.words) {
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

    return detections;
  } finally {
    if (worker) await worker.terminate();
  }
}

/**
 * MAIN OPTIMIZED DETECTION
 * Multi-pass với deskew + preprocessing + regions
 */
export async function detectBibNumbersOptimized(
  imageUrl: string,
): Promise<BibDetection[]> {
  try {
    console.log("🔍 Optimized BIB detection started...");

    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const originalBuffer = Buffer.from(arrayBuffer);

    // Deskew
    const deskewedBuffers = await deskewImage(originalBuffer);
    const allDetections = new Map<string, BibDetection>();

    for (const [dIdx, deskewedBuffer] of deskewedBuffers.entries()) {
      console.log(`Deskew ${dIdx + 1}/${deskewedBuffers.length}...`);

      // Preprocess
      const preprocessedBuffers = await advancedPreprocess(deskewedBuffer);

      for (const [pIdx, preprocessedBuffer] of preprocessedBuffers.entries()) {
        console.log(
          `  Preprocess ${pIdx + 1}/${preprocessedBuffers.length}...`,
        );

        // Regions
        const regions = await detectBibRegions(preprocessedBuffer);

        for (const region of regions) {
          try {
            const cropped = await sharp(preprocessedBuffer)
              .extract(region)
              .toBuffer();

            const detections = await ocrMultipleConfigs(cropped);

            for (const detection of detections) {
              detection.bbox.x += region.x;
              detection.bbox.y += region.y;
              detection.region = region.name;

              const existing = allDetections.get(detection.bibNumber);
              if (!existing || detection.confidence > existing.confidence) {
                allDetections.set(detection.bibNumber, detection);
              }
            }
          } catch (err) {
            console.warn(`Region ${region.name} failed:`, err);
          }
        }
      }
    }

    const result = Array.from(allDetections.values()).sort(
      (a, b) => b.confidence - a.confidence,
    );

    console.log(`✅ Found ${result.length} BIBs (optimized)`);
    return result;
  } catch (error) {
    console.error("❌ Optimized detection error:", error);
    return [];
  }
}

/**
 * FAST VERSION (cho batch processing)
 */
export async function detectBibNumbersFast(
  imageUrl: string,
): Promise<BibDetection[]> {
  try {
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const preprocessed = await sharp(buffer)
      .greyscale()
      .normalize()
      .sharpen({ sigma: 1.5 })
      .threshold(128)
      .toBuffer();

    const { width: w, height: h } = await sharp(preprocessed).metadata();

    const cropped = await sharp(preprocessed)
      .extract({
        left: Math.floor(w! * 0.3),
        top: Math.floor(h! * 0.15),
        width: Math.floor(w! * 0.4),
        height: Math.floor(h! * 0.35),
      })
      .toBuffer();

    return await ocrMultipleConfigs(cropped);
  } catch (error) {
    console.error("Fast detection error:", error);
    return [];
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
