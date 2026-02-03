import { google } from "googleapis";
import "dotenv/config";
async function listFiles() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  console.log("📁 client_email:\n", process.env.GOOGLE_DRIVE_CLIENT_EMAIL);
  console.log("📁 private_key:\n", process.env.GOOGLE_DRIVE_PRIVATE_KEY);
  const drive = google.drive({ version: "v3", auth });

  console.log("📁 Files in Google Drive:\n");

  const result = await drive.files.list({
    pageSize: 20,
    fields: "files(id, name, mimeType, size, createdTime, webViewLink)",
    orderBy: "createdTime desc",
  });

  const files = result.data.files;
  if (!files || files.length === 0) {
    console.log("No files found.");
    return;
  }

  files.forEach((file, index) => {
    console.log(`${index + 1}. ${file.name}`);
    console.log(`   ID: ${file.id}`);
    console.log(`   Type: ${file.mimeType}`);
    console.log(
      `   Size: ${file.size ? Math.round(parseInt(file.size) / 1024) + " KB" : "N/A"}`
    );
    console.log(`   Created: ${file.createdTime}`);
    console.log(`   Link: ${file.webViewLink}`);
    console.log();
  });
}

listFiles();
