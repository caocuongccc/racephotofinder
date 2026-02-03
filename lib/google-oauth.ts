// lib/google-oauth.ts
import { google } from "googleapis";
import prisma from "./prisma";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

/**
 * Generate auth URL for user to authorize
 */
export function getAuthUrl() {
  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ];

  return oauth2Client.generateAuthUrl({
    access_type: "offline", // Get refresh token
    scope: scopes,
    prompt: "consent", // Force consent to get refresh token
  });
}

/**
 * Exchange code for tokens
 */
export async function getTokensFromCode(code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Store tokens in database
 */
export async function storeUserTokens(
  userId: string,
  tokens: {
    access_token?: string | null;
    refresh_token?: string | null;
    expiry_date?: number | null;
  },
) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: tokens.access_token,
      googleRefreshToken: tokens.refresh_token,
      googleTokenExpiry: tokens.expiry_date
        ? new Date(tokens.expiry_date)
        : null,
    },
  });
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleAccessToken: true,
      googleRefreshToken: true,
      googleTokenExpiry: true,
    },
  });

  if (!user?.googleAccessToken || !user?.googleRefreshToken) {
    throw new Error("User has not authorized Google Drive access");
  }

  // Check if token is expired
  const now = new Date();
  const expiry = user.googleTokenExpiry || now;

  if (expiry > now) {
    // Token still valid
    return user.googleAccessToken;
  }

  // Token expired - refresh it
  console.log("🔄 Refreshing Google access token...");

  oauth2Client.setCredentials({
    refresh_token: user.googleRefreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();

  // Store new tokens
  await storeUserTokens(userId, credentials);

  return credentials.access_token!;
}

/**
 * Get authenticated Drive client for user
 */
export async function getUserDriveClient(userId: string) {
  const accessToken = await getValidAccessToken(userId);

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  return google.drive({ version: "v3", auth: oauth2Client });
}

/**
 * Revoke user's Google access
 */
export async function revokeUserAccess(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleAccessToken: true },
  });

  if (user?.googleAccessToken) {
    await oauth2Client.revokeToken(user.googleAccessToken);
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
    },
  });
}
