// app/api/auth/google/callback/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getTokensFromCode, storeUserTokens } from "@/lib/google-oauth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.redirect("/login");
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      console.error("OAuth error:", error);
      return NextResponse.redirect("/dashboard?error=oauth_failed");
    }

    if (!code) {
      return NextResponse.redirect("/dashboard?error=no_code");
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code);

    // Store tokens
    await storeUserTokens(session.user.id, tokens);

    console.log("✅ Google Drive connected for user:", session.user.email);

    return NextResponse.redirect("/dashboard?success=google_connected");
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect("/dashboard?error=oauth_callback_failed");
  }
}
