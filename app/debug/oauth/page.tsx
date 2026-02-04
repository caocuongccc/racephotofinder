// app/debug/oauth/page.tsx
"use client";
import "dotenv/config";
export default function OAuthDebugPage() {
  const checkConfig = () => {
    console.log("OAuth Config:");
    console.log("CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);
    console.log("REDIRECT_URI:", process.env.GOOGLE_REDIRECT_URI);

    // Test auth URL
    fetch("/api/auth/google/debug")
      .then((res) => res.json())
      .then((data) => {
        console.log("Auth URL:", data.authUrl);
        console.log("Expected redirect:", data.redirectUri);
      });
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">OAuth Debug</h1>
      <button
        onClick={checkConfig}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Check Config
      </button>

      <div className="mt-4 text-sm">
        <p>Check browser console for details</p>
      </div>
    </div>
  );
}
