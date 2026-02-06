// Face detection using face-api.js on client side
// Models will be loaded from CDN

export interface FaceDescriptor {
  descriptor: Float32Array;
  detection: {
    box: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
}

let modelsLoaded = false;

export async function loadFaceApiModels() {
  if (modelsLoaded) return true;

  try {
    // @ts-ignore
    const faceapi = window.faceapi;

    if (!faceapi) {
      console.error("face-api.js not loaded");
      return false;
    }

    const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";

    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);

    modelsLoaded = true;
    console.log("Face-api models loaded successfully");
    return true;
  } catch (error) {
    console.error("Error loading face-api models:", error);
    return false;
  }
}

export async function detectFaces(
  imageElement: HTMLImageElement,
): Promise<FaceDescriptor[]> {
  try {
    // @ts-ignore
    const faceapi = window.faceapi;

    if (!faceapi) {
      throw new Error("face-api.js not loaded");
    }

    if (!modelsLoaded) {
      await loadFaceApiModels();
    }

    const detections = await faceapi
      //.detectAllFaces(imageElement, new faceapi.TinyFaceDetectorOptions())
      .detectAllFaces(imageElement, new faceapi.SsdMobilenetv1Options())
      .withFaceLandmarks()
      .withFaceDescriptors();

    return detections.map((detection: any) => ({
      descriptor: detection.descriptor,
      detection: {
        box: {
          x: detection.detection.box.x,
          y: detection.detection.box.y,
          width: detection.detection.box.width,
          height: detection.detection.box.height,
        },
      },
    }));
  } catch (error) {
    console.error("Error detecting faces:", error);
    return [];
  }
}

export function calculateSimilarity(
  descriptor1: Float32Array,
  descriptor2: Float32Array,
): number {
  // Calculate Euclidean distance
  let sum = 0;
  for (let i = 0; i < descriptor1.length; i++) {
    const diff = descriptor1[i] - descriptor2[i];
    sum += diff * diff;
  }
  const distance = Math.sqrt(sum);

  // Convert distance to similarity (0-1, where 1 is identical)
  // Typical face recognition threshold is 0.6
  const similarity = Math.max(0, 1 - distance);
  return similarity;
}

export function arrayToBase64(array: Float32Array): string {
  const bytes = new Uint8Array(array.buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArray(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Float32Array(bytes.buffer);
}
