/**
 * Uploads base64 images to the novelty-public-videos GCS bucket.
 * Authenticates via service account key file (GCS_SERVICE_ACCOUNT_KEY_PATH).
 * Returns CDN URLs (https://videos.novelty.sh/...).
 */

import * as crypto from "crypto";
import * as fs from "fs";

const BUCKET = "novelty-public-videos";
const CDN_BASE = "https://videos.novelty.sh";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/devstorage.read_write";

// ---------------------------------------------------------------------------
// Service account auth — JWT → access token
// ---------------------------------------------------------------------------

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

let _cachedToken: { token: string; expiresAt: number } | null = null;

function loadServiceAccount(): ServiceAccountKey {
  // Prefer inline JSON (for Vercel / serverless), fall back to file path (for local dev)
  const keyJson = process.env.GCS_SERVICE_ACCOUNT_KEY;
  if (keyJson) {
    return JSON.parse(keyJson);
  }

  const keyPath = process.env.GCS_SERVICE_ACCOUNT_KEY_PATH;
  if (keyPath) {
    return JSON.parse(fs.readFileSync(keyPath, "utf-8"));
  }

  throw new Error(
    "Neither GCS_SERVICE_ACCOUNT_KEY nor GCS_SERVICE_ACCOUNT_KEY_PATH is set.",
  );
}

function createSignedJwt(sa: ServiceAccountKey): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");

  const unsigned = `${encode(header)}.${encode(payload)}`;
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(unsigned)
    .sign(sa.private_key, "base64url");

  return `${unsigned}.${signature}`;
}

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer)
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 60_000) {
    return _cachedToken.token;
  }

  const sa = loadServiceAccount();
  const jwt = createSignedJwt(sa);

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  _cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return data.access_token;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

/** Parse a base64 data URL into content type + raw base64 */
function parseDataUrl(dataUrl: string): { contentType: string; base64: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid base64 data URL");
  }
  return { contentType: match[1], base64: match[2] };
}

/** Get file extension from content type */
function extFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[contentType] || "png";
}

/** Upload a single base64 data URL to GCS, return the CDN URL. */
async function uploadOne(
  base64DataUrl: string,
  objectName: string,
): Promise<string> {
  const { contentType, base64 } = parseDataUrl(base64DataUrl);
  const binaryData = new Uint8Array(Buffer.from(base64, "base64"));
  const token = await getAccessToken();

  const uploadUrl =
    `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o` +
    `?uploadType=media&name=${encodeURIComponent(objectName)}`;

  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": contentType,
      Authorization: `Bearer ${token}`,
    },
    body: binaryData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GCS upload failed (${res.status}): ${text}`);
  }

  return `${CDN_BASE}/${objectName}`;
}

export interface UploadedImage {
  index: number;
  url: string;
}

/**
 * Upload an array of base64 images to GCS in parallel.
 * Returns array of { index (1-based), url } with CDN URLs.
 */
export async function uploadImages(
  base64Images: string[],
  sessionId: string,
): Promise<UploadedImage[]> {
  const timestamp = Date.now();

  const uploads = base64Images.map(async (dataUrl, i) => {
    const { contentType } = parseDataUrl(dataUrl);
    const ext = extFromContentType(contentType);
    const objectName = `motion-graphics/images/${sessionId}/${timestamp}-${i + 1}.${ext}`;
    const url = await uploadOne(dataUrl, objectName);
    return { index: i + 1, url };
  });

  return Promise.all(uploads);
}
