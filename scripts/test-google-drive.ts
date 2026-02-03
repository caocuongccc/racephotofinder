// scripts/test-google-drive.ts
import { google } from "googleapis";
import "dotenv/config";

console.log("Testing Google Drive credentials...");
console.log("CLIENT_EMAIL:", process.env.GOOGLE_DRIVE_CLIENT_EMAIL);
console.log("PRIVATE_KEY exists:", !!process.env.GOOGLE_DRIVE_PRIVATE_KEY);
console.log(
  "PRIVATE_KEY length:",
  process.env.GOOGLE_DRIVE_PRIVATE_KEY?.length,
);

try {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  console.log("Auth object:", auth);
  console.log("✅ Auth initialized successfully");

  const drive = google.drive({ version: "v3", auth });

  // Test listing files
  drive.files
    .list({ pageSize: 1 })
    .then(() => {
      console.log("✅ Successfully connected to Google Drive!");
    })
    .catch((error) => {
      console.error("❌ Failed to connect:", error.message);
    });
} catch (error: any) {
  console.error("❌ Auth initialization failed:", error.message);
}
