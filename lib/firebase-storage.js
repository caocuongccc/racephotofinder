import admin from "firebase-admin";
import { getStorage } from "firebase-admin/storage";
import { v4 as uuidv4 } from "uuid";

// ✅ Khởi tạo Firebase Admin (chỉ khởi tạo 1 lần)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET, // ví dụ: "your-project-id.appspot.com"
  });
}

const bucket = getStorage().bucket();

/**
 * 📤 Upload file trực tiếp lên Firebase Storage (server-side)
 */
export async function uploadToFirebase(key, buffer, contentType = "application/octet-stream") {
  const file = bucket.file(key);
  await file.save(buffer, {
    contentType,
    metadata: { firebaseStorageDownloadTokens: uuidv4() },
  });
  console.log("✅ Uploaded to Firebase:", key);
  return key;
}

/**
 * 📥 Generate signed download URL
 */
export async function generateDownloadUrl(key, expiresIn = 3600) {
  const file = bucket.file(key);
  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expiresIn * 1000,
  });
  return url;
}

/**
 * ❌ Delete file from Firebase
 */
export async function deleteFromFirebase(key) {
  try {
    await bucket.file(key).delete();
    console.log("🗑️ Deleted:", key);
  } catch (err) {
    if (err.code === 404) console.warn("⚠️ File not found:", key);
    else throw err;
  }
}

/**
 * 🌍 Get public URL (nếu bạn đã bật public access)
 */
export function getPublicUrl(key) {
  return `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${key}`;
}

/**
 * 🔑 Generate unique file key (tương tự logic cũ của bạn)
 */
export function generateFileKey(eventId, filename, type = "original") {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const ext = filename.split(".").pop();

  if (type === "thumbnail") {
    return `events/${eventId}/thumbnails/${timestamp}-${random}.${ext}`;
  }
  return `events/${eventId}/photos/${timestamp}-${random}.${ext}`;
}
