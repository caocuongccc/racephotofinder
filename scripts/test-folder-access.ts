import { google } from "googleapis";
import "dotenv/config";
async function testFolderAccess() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
      private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    },
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  console.log("🔑 Auth initialized", auth);
  const drive = google.drive({ version: "v3", auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

  console.log("🔍 Testing folder access...");
  console.log("Folder ID:", folderId);
  console.log("Service Account:", process.env.GOOGLE_DRIVE_CLIENT_EMAIL);

  try {
    // Try to get folder info
    const folder = await drive.files.get({
      fileId: folderId,
      fields: "id, name, owners, permissions, capabilities",
      supportsAllDrives: true,
    });

    console.log("✅ Folder found!");
    console.log("Name:", folder.data.name);
    console.log("Can add children:", folder.data.capabilities?.canAddChildren);
    console.log("Can edit:", folder.data.capabilities?.canEdit);

    // Check permissions
    const permissions = await drive.permissions.list({
      fileId: folderId,
      fields: "permissions(id, type, role, emailAddress)",
    });

    console.log("\n📋 Folder permissions:");
    permissions.data.permissions?.forEach((perm) => {
      console.log(
        `  - ${perm.type}: ${perm.emailAddress || "anyone"} (${perm.role})`,
      );
    });

    // Try to create a test file
    console.log("\n📤 Testing file creation...");
    const testFile = await drive.files.create({
      supportsAllDrives: true,
      requestBody: {
        name: "test-access.txt",
        parents: [folderId],
      },
      media: {
        mimeType: "text/plain",
        body: "Test file",
      },
    });

    console.log("✅ Test file created:", testFile.data.id);

    // Clean up
    await drive.files.delete({ fileId: testFile.data.id! });
    console.log("✅ Test file deleted");

    console.log("\n🎉 Folder access is working correctly!");
  } catch (error: any) {
    console.error("❌ Error:", error.message);

    if (error.message?.includes("File not found")) {
      console.log("\n⚠️  Folder not found or not shared with service account.");
      console.log(
        "Please share the folder with:",
        process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
      );
    }
  }
}

testFolderAccess();
