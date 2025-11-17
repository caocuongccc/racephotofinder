import "dotenv/config";
async function verify() {
  console.log("Checking credentials...");

  const clientEmail = process.env.GOOGLE_DRIVE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_DRIVE_PRIVATE_KEY;
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  console.log("Client Email:", clientEmail);
  console.log("Folder ID:", folderId);
  console.log("Private Key exists:", !!privateKey);
  console.log("Private Key starts with:", privateKey?.substring(0, 30));
  console.log("Private Key length:", privateKey?.length);
  console.log("Has newlines:", privateKey?.includes("\\n"));

  // Test parsing
  try {
    const key = privateKey?.replace(/\\n/g, "\n");
    console.log("✅ Key format OK");
    console.log("Formatted key starts with:", key?.substring(0, 30));
  } catch (error) {
    console.error("❌ Key format error:", error);
  }
}

verify();
