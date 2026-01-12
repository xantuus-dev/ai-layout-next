import { google } from 'googleapis';

// Google OAuth Configuration
export const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || `${process.env.NEXTAUTH_URL}/api/integrations/google/callback`
);

// Scopes for different Google services
export const SCOPES = {
  drive: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly',
  ],
  gmail: [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.readonly',
  ],
  calendar: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ],
  profile: [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],
};

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  scope?: string;
  token_type?: string;
}

/**
 * Generate OAuth URL for user authorization
 */
export function generateAuthUrl(services: ('drive' | 'gmail' | 'calendar')[] = []) {
  const scopes = [
    ...SCOPES.profile,
    ...(services.includes('drive') ? SCOPES.drive : []),
    ...(services.includes('gmail') ? SCOPES.gmail : []),
    ...(services.includes('calendar') ? SCOPES.calendar : []),
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: scopes,
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(code: string): Promise<GoogleTokens> {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens as GoogleTokens;
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials as GoogleTokens;
}

/**
 * Set credentials for the OAuth client
 */
export function setCredentials(tokens: GoogleTokens) {
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
}

/**
 * Check if token is expired or will expire soon (within 5 minutes)
 */
export function isTokenExpired(expiryDate: Date | number): boolean {
  const expiry = typeof expiryDate === 'number' ? expiryDate : expiryDate.getTime();
  const now = Date.now();
  const fiveMinutes = 5 * 60 * 1000;
  return expiry - now < fiveMinutes;
}

/**
 * Get a valid OAuth client with tokens
 * Automatically refreshes if expired
 */
export async function getAuthenticatedClient(
  accessToken: string,
  refreshToken: string | null,
  expiryDate: Date | null
): Promise<typeof oauth2Client> {
  // Check if token is expired
  if (expiryDate && isTokenExpired(expiryDate)) {
    if (!refreshToken) {
      throw new Error('Token expired and no refresh token available');
    }

    // Refresh the token
    const newTokens = await refreshAccessToken(refreshToken);
    setCredentials(newTokens);
    return oauth2Client;
  }

  // Use existing token
  setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken || undefined,
    expiry_date: expiryDate ? new Date(expiryDate).getTime() : undefined,
  });

  return oauth2Client;
}

/**
 * Revoke access token
 */
export async function revokeToken(token: string): Promise<void> {
  await oauth2Client.revokeToken(token);
}
