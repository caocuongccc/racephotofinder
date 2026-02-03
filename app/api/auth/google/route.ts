// app/api/auth/google/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAuthUrl } from "@/lib/google-oauth";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate auth URL
    const authUrl = getAuthUrl();

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("OAuth init error:", error);
    return NextResponse.json(
      { error: "Failed to initialize OAuth" },
      { status: 500 },
    );
  }
}
