// app/api/auth/google/debug/route.ts
import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google-oauth";

export async function GET() {
  const authUrl = getAuthUrl();

  return NextResponse.json({
    authUrl,
    clientId: process.env.GOOGLE_CLIENT_ID,
    redirectUri: process.env.GOOGLE_REDIRECT_URI,
    scopes: [
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
  });
}
