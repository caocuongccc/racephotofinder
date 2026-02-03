import { google } from "googleapis";
import { Readable } from "stream";
import * as path from "path";
import * as fs from "fs";

// Initialize Google Drive API
let drive: any;
let PARENT_FOLDER_ID: string;

function initializeGoogleDrive() {
  try {
    // Try loading from file first (development)
    const serviceAccountPath = path.join(process.cwd(), "service-account.json");

    let auth: any;

    if (fs.existsSync(serviceAccountPath)) {
      console.log("📂 Loading credentials from service-account.json");
      auth = new google.auth.GoogleAuth({
        keyFile: serviceAccountPath,
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      console.log("📂 Loading credentials from GOOGLE_APPLICATION_CREDENTIALS");
      auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });
    } else if (
      process.env.GOOGLE_DRIVE_CLIENT_EMAIL &&
      process.env.GOOGLE_DRIVE_PRIVATE_KEY
    ) {
      console.log("🔐 Loading credentials from environment variables");

      const credentials = {
        client_email: process.env.GOOGLE_DRIVE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_DRIVE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      };

      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });
    } else {
      throw new Error(
        "Google Drive credentials not found. Please provide one of:\n" +
          "1. service-account.json file in project root\n" +
          "2. GOOGLE_APPLICATION_CREDENTIALS env variable\n" +
          "3. GOOGLE_DRIVE_CLIENT_EMAIL and GOOGLE_DRIVE_PRIVATE_KEY env variables",
      );
    }

    drive = google.drive({ version: "v3", auth });
    PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID || "root";

    console.log("✅ Google Drive initialized successfully");
    console.log("📁 Parent folder ID:", PARENT_FOLDER_ID);

    return drive;
  } catch (error: any) {
    console.error("❌ Failed to initialize Google Drive:", error.message);
    throw error;
  }
}

// Initialize on module load
initializeGoogleDrive();

/**
 * Create folder in Google Drive (if not exists)
 */
async function getOrCreateFolder(
  folderName: string,
  parentId: string = PARENT_FOLDER_ID,
): Promise<string> {
  try {
    // Check if folder exists
    const response = await drive.files.list({
      q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
      fields: "files(id, name)",
    });

    if (response.data.files && response.data.files.length > 0) {
      console.log(
        `✅ Folder '${folderName}' already exists:`,
        response.data.files[0].id,
      );
      return response.data.files[0].id!;
    }

    // Create folder if not exists
    console.log(`📁 Creating folder '${folderName}' in parent:`, parentId);

    const folderMetadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    };

    const folder = await drive.files.create({
      requestBody: folderMetadata,
      fields: "id, name",
    });

    console.log(`✅ Created folder '${folderName}':`, folder.data.id);
    return folder.data.id!;
  } catch (error: any) {
    console.error(`❌ Error creating folder '${folderName}':`, error.message);
    throw error;
  }
}

// Rest of your functions remain the same...
export async function uploadToGoogleDrive(
  fileName: string,
  buffer: Buffer,
  mimeType: string,
  folderPath: string[] = [],
): Promise<{ fileId: string; webViewLink: string; webContentLink: string }> {
  try {
    if (!PARENT_FOLDER_ID) {
      throw new Error("GOOGLE_DRIVE_FOLDER_ID is not set");
    }

    // Create nested folders
    let currentParentId = PARENT_FOLDER_ID;
    for (const folderName of folderPath) {
      currentParentId = await getOrCreateFolder(folderName, currentParentId);
    }

    console.log("📤 Uploading file:", fileName);
    console.log("📁 To folder:", currentParentId);

    // Convert buffer to readable stream
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);

    const fileMetadata = {
      name: fileName,
      parents: [currentParentId],
    };

    const media = {
      mimeType,
      body: readable,
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: "id, webViewLink, webContentLink",
    });

    console.log("✅ File uploaded:", response.data.id);

    // Make file publicly accessible
    try {
      await drive.permissions.create({
        fileId: response.data.id!,
        requestBody: {
          role: "reader",
          type: "anyone",
        },
      });
      console.log("✅ File set to public");
    } catch (permError) {
      console.warn("⚠️ Could not set public permissions:", permError);
    }

    return {
      fileId: response.data.id!,
      webViewLink: response.data.webViewLink!,
      webContentLink: response.data.webContentLink || "",
    };
  } catch (error: any) {
    console.error("❌ Upload error:", error.message);
    throw error;
  }
}

// Export other functions...
export { getOrCreateFolder };
