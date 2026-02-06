// ============================================
// TEST OCR.SPACE API - Node.js version
// Run: node test-ocr-space.js
// ============================================
import "dotenv/config";
async function testOCRSpace() {
  console.log("🧪 Testing OCR.space API...\n");

  // Check API key
  const apiKey = process.env.OCR_SPACE_API_KEY;

  if (!apiKey) {
    console.error("❌ Error: OCR_SPACE_API_KEY not set\n");
    console.log("📝 Please set your API key in .env:");
    console.log("   OCR_SPACE_API_KEY=your-key-here\n");
    console.log("🔑 Get free API key:");
    console.log("   https://ocr.space/ocrapi\n");
    process.exit(1);
  }

  console.log(`✅ API key found: ${apiKey.substring(0, 10)}...\n`);

  // Test with sample image URL
  const testImageUrl =
    "https://drive.google.com/file/d/1zPYtqW00DsxEzbQd55A2FYjSAxc2z9jT/view?usp=sharing";

  console.log("📤 Sending test request...");
  console.log(`   Image: ${testImageUrl}\n`);

  try {
    const formData = new FormData();
    formData.append("url", testImageUrl);
    formData.append("apikey", apiKey);
    formData.append("language", "eng");
    formData.append("OCREngine", "2"); // Engine 2 better for numbers

    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();

    console.log("📥 Response received\n");

    if (!result.IsErroredOnProcessing && result.ParsedResults?.length > 0) {
      console.log("✅ OCR.space API is working!\n");

      const parsedText = result.ParsedResults[0].ParsedText;
      console.log("📝 Extracted text:");
      console.log(parsedText);
      console.log("");

      // Try to find numbers
      const numbers = parsedText.match(/\b\d{1,5}\b/g);
      if (numbers) {
        console.log("🔢 Found numbers:", numbers);
      }

      console.log("\n✅ Test successful! OCR.space is ready to use.");
      console.log("\n📋 Next steps:");
      console.log("   1. Copy ocr-space-api.ts to lib/");
      console.log(
        "   2. Copy fix-confirm-route-multi-engine.ts to app/api/photos/[id]/confirm/route.ts",
      );
      console.log("   3. Restart: npm run dev");
    } else {
      console.error("❌ API Error:");
      console.error(JSON.stringify(result.ErrorMessage || result, null, 2));
      console.log("\n💡 Troubleshooting:");
      console.log("   - Check if API key is valid");
      console.log("   - Verify you haven't exceeded free tier (25k/month)");
      console.log("   - Try getting a new key from https://ocr.space/ocrapi");
    }
  } catch (error) {
    console.error("❌ Network error:", error.message);
    console.log("\n💡 Troubleshooting:");
    console.log("   - Check internet connection");
    console.log("   - Verify firewall allows HTTPS requests");
  }
}

// Run test
testOCRSpace().catch(console.error);
