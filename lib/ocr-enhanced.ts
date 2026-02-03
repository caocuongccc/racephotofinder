import Tesseract from "tesseract.js";
import sharp from "sharp";

export interface BibDetection {
  bibNumber: string;
  confidence: number;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  faceBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

/**
 * Pre-process image for better OCR
 */
async function preprocessForOCR(buffer: Buffer): Promise<Buffer> {
  return await sharp(buffer)
    .greyscale()
    .normalize()
    .threshold(128)
    .sharpen()
    .resize(2000, null, {
      // Upscale if too small
      withoutEnlargement: true,
      fit: "inside",
    })
    .toBuffer();
}

/**
 * Detect BIB regions (chest area where BIBs usually are)
 */
async function detectBibRegions(buffer: Buffer): Promise<
  Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>
> {
  const metadata = await sharp(buffer).metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  // BIBs are typically in these regions
  return [
    // Center chest
    {
      x: Math.floor(width * 0.25),
      y: Math.floor(height * 0.15),
      width: Math.floor(width * 0.5),
      height: Math.floor(height * 0.4),
    },
    // Left chest
    {
      x: Math.floor(width * 0.15),
      y: Math.floor(height * 0.15),
      width: Math.floor(width * 0.35),
      height: Math.floor(height * 0.4),
    },
    // Right chest
    {
      x: Math.floor(width * 0.5),
      y: Math.floor(height * 0.15),
      width: Math.floor(width * 0.35),
      height: Math.floor(height * 0.4),
    },
    // Full upper body (fallback)
    {
      x: 0,
      y: 0,
      width: width,
      height: Math.floor(height * 0.6),
    },
  ];
}

/**
 * Detect faces in image (để associate BIB với người)
 */
async function detectFaces(buffer: Buffer): Promise<
  Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>
> {
  // Simplified face detection using sharp
  // In production, use face-api.js or similar

  const metadata = await sharp(buffer).metadata();
  const width = metadata.width!;
  const height = metadata.height!;

  // Mock face detection - replace with actual face detection
  // For now, assume face is in upper portion
  return [
    {
      x: Math.floor(width * 0.3),
      y: Math.floor(height * 0.05),
      width: Math.floor(width * 0.4),
      height: Math.floor(height * 0.3),
      confidence: 0.8,
    },
  ];
}

/**
 * Multi-region OCR with face context
 */
export async function detectBibWithContext(
  imageUrl: string,
): Promise<BibDetection[]> {
  try {
    // Download image
    const response = await fetch(imageUrl);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Detect faces first
    const faces = await detectFaces(buffer);
    const regions = await detectBibRegions(buffer);

    const allDetections: Map<string, BibDetection> = new Map();

    for (const region of regions) {
      // Crop region
      const croppedBuffer = await sharp(buffer).extract(region).toBuffer();

      // Preprocess
      const processedBuffer = await preprocessForOCR(croppedBuffer);

      // OCR
      const result = await Tesseract.recognize(processedBuffer, "eng", {
        tessedit_char_whitelist: "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", // BIBs can have letters
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
      });

      // Extract BIB numbers
      for (const word of result.data.words) {
        const text = word.text.trim();

        // BIB patterns:
        // - Pure numbers: 123, 1234, 12345
        // - With prefix: A123, B456, VIP789
        const bibMatch = text.match(/^([A-Z]{0,3})(\d{1,5})$/);

        if (bibMatch && word.confidence > 60) {
          const bibNumber = bibMatch[0]; // Full BIB (e.g., "A123" or "1234")

          const bbox = {
            x: region.x + word.bbox.x0,
            y: region.y + word.bbox.y0,
            width: word.bbox.x1 - word.bbox.x0,
            height: word.bbox.y1 - word.bbox.y0,
          };

          // Find closest face
          let closestFace = null;
          let minDistance = Infinity;

          for (const face of faces) {
            const distance = Math.sqrt(
              Math.pow(bbox.x - face.x, 2) + Math.pow(bbox.y - face.y, 2),
            );
            if (distance < minDistance) {
              minDistance = distance;
              closestFace = face;
            }
          }

          const detection: BibDetection = {
            bibNumber,
            confidence: word.confidence / 100,
            bbox,
            faceBox: closestFace || undefined,
          };

          // Keep highest confidence for each BIB
          const existing = allDetections.get(bibNumber);
          if (!existing || detection.confidence > existing.confidence) {
            allDetections.set(bibNumber, detection);
          }
        }
      }
    }

    return Array.from(allDetections.values()).sort(
      (a, b) => b.confidence - a.confidence,
    );
  } catch (error) {
    console.error("BIB detection error:", error);
    return [];
  }
}

/**
 * Validate BIB number format
 */
export function isValidBibNumber(bib: string): boolean {
  // Allow:
  // - Pure numbers: 123, 1234
  // - With prefix: A123, VIP456
  return /^[A-Z]{0,3}\d{1,5}$/.test(bib);
}
