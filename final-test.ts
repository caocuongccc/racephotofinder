import { google } from "googleapis";
import { uploadToGoogleDrive } from "./lib/google-drive";
import "dotenv/config";
async function finalTest() {
  console.log("🚀 Final Test\n");

  // Test 1: Credentials
  console.log("1️⃣ Testing credentials...");
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });

  const drive = google.drive({ version: "v3", auth });
  console.log("✅ Auth initialized\n");

  // Test 2: List root folder
  console.log("2️⃣ Testing root access...");
  try {
    const rootFiles = await drive.files.list({
      pageSize: 5,
      fields: "files(id, name)",
    });
    console.log("✅ Root access OK");
    console.log("   Files in root:", rootFiles.data.files?.length || 0);
  } catch (error: any) {
    console.error("❌ Root access failed:", error.message);
  }
  console.log();

  // Test 3: Access specific folder
  console.log("3️⃣ Testing folder access...");
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  console.log("3️⃣ folderId:", folderId);
  try {
    const folder = await drive.files.get({
      fileId: folderId!,
      fields: "id, name, capabilities",
    });
    console.log("✅ Folder access OK");
    console.log("   Folder:", folder.data.name);
    console.log(
      "   Can add children:",
      folder.data.capabilities?.canAddChildren
    );
  } catch (error: any) {
    console.error("❌ Folder access failed:", error.message);
    console.log("   Trying with root instead...");
    process.env.GOOGLE_DRIVE_FOLDER_ID = "root";
  }
  console.log();

  // Test 4: Upload test file
  console.log("4️⃣ Testing file upload...");
  try {
    const result = await uploadToGoogleDrive(
      "test-final.txt",
      Buffer.from("Hello from RacePhoto Finder!"),
      "text/plain",
      ["test"]
    );
    console.log("✅ Upload successful!");
    console.log("   File ID:", result.fileId);
    console.log("   View:", result.webViewLink);

    // Clean up
    await drive.files.delete({ fileId: result.fileId });
    console.log("✅ Test file cleaned up");
  } catch (error: any) {
    console.error("❌ Upload failed:", error.message);
  }

  console.log("\n🎉 Test complete!");
}

finalTest();
