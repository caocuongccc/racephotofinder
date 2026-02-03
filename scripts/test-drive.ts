import { uploadToGoogleDrive } from "../lib/google-drive";

async function test() {
  try {
    console.log("Testing Google Drive upload...");

    const testBuffer = Buffer.from("Hello World");
    const result = await uploadToGoogleDrive(
      "test.txt",
      testBuffer,
      "text/plain",
      ["test"],
    );

    console.log("✅ Upload successful!");
    console.log("File ID:", result.fileId);
    console.log("View link:", result.webViewLink);
  } catch (error) {
    console.error("❌ Upload failed:", error);
  }
}

test();
