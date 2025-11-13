// OCR service to extract BIB numbers from photos
import Tesseract from 'tesseract.js'

export interface BibDetection {
  bibNumber: string
  confidence: number
  bbox: {
    x: number
    y: number
    width: number
    height: number
  }
}

/**
 * Extract BIB numbers from image
 */
export async function extractBibNumbers(imageUrl: string): Promise<BibDetection[]> {
  try {
    const result = await Tesseract.recognize(imageUrl, 'eng', {
      logger: (m) => console.log(m),
    })

    const bibNumbers: BibDetection[] = []
    
    // result.data.lines is an array of line objects from Tesseract
    const lines = result.data.blocks || []

    for (const line of lines) {
      // Look for patterns that match BIB numbers (usually 1-5 digits)
      const text = line.text.trim()
      const matches = text.match(/\b\d{1,5}\b/g)

      if (matches) {
        for (const match of matches) {
          bibNumbers.push({
            bibNumber: match,
            confidence: line.confidence / 100,
            bbox: {
              x: line.bbox.x0,
              y: line.bbox.y0,
              width: line.bbox.x1 - line.bbox.x0,
              height: line.bbox.y1 - line.bbox.y0,
            },
          })
        }
      }
    }

    // Filter by confidence > 60%
    return bibNumbers.filter((bib) => bib.confidence > 0.6)
  } catch (error) {
    console.error('OCR error:', error)
    return []
  }
}

/**
 * Process image and auto-tag with detected BIB numbers
 */
export async function autoTagPhoto(
  photoUrl: string,
  eventId: string
): Promise<{ bibNumbers: string[]; confidence: number }> {
  const detections = await extractBibNumbers(photoUrl)

  if (detections.length === 0) {
    return { bibNumbers: [], confidence: 0 }
  }

  // Calculate average confidence
  const avgConfidence =
    detections.reduce((sum, d) => sum + d.confidence, 0) / detections.length

  return {
    bibNumbers: detections.map((d) => d.bibNumber),
    confidence: avgConfidence,
  }
}