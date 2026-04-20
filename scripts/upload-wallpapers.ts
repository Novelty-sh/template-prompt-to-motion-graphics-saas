/**
 * One-shot uploader for WhatsApp wallpaper backgrounds.
 * Uploads public/ws-dark-theme.jpg and public/ws-light-theme.png to GCS
 * under motion-graphics/wallpapers/ with stable paths, and prints their CDN URLs.
 *
 * Run: npx tsx scripts/upload-wallpapers.ts
 */

import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const BUCKET = "novelty-public-videos";
const CDN_BASE = "https://videos.novelty.sh";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/devstorage.read_write";

function loadServiceAccount() {
  const keyJson = process.env.GCS_SERVICE_ACCOUNT_KEY;
  if (keyJson) return JSON.parse(keyJson);
  const keyPath = process.env.GCS_SERVICE_ACCOUNT_KEY_PATH;
  if (keyPath) return JSON.parse(fs.readFileSync(keyPath, "utf-8"));
  throw new Error(
    "Neither GCS_SERVICE_ACCOUNT_KEY nor GCS_SERVICE_ACCOUNT_KEY_PATH is set.",
  );
}

async function getAccessToken(): Promise<string> {
  const sa = loadServiceAccount();
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
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

async function upload(localPath: string, objectName: string, contentType: string) {
  const body = fs.readFileSync(localPath);
  const token = await getAccessToken();
  const url =
    `https://storage.googleapis.com/upload/storage/v1/b/${BUCKET}/o` +
    `?uploadType=media&name=${encodeURIComponent(objectName)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": contentType, Authorization: `Bearer ${token}` },
    body,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await res.text()}`);
  return `${CDN_BASE}/${objectName}`;
}

async function main() {
  const root = path.join(__dirname, "..");
  const files: Array<[string, string, string]> = [
    [
      path.join(root, "public/ws-dark-theme.jpg"),
      "motion-graphics/wallpapers/whatsapp-dark.jpg",
      "image/jpeg",
    ],
    [
      path.join(root, "public/ws-light-theme.png"),
      "motion-graphics/wallpapers/whatsapp-light.png",
      "image/png",
    ],
  ];
  for (const [local, obj, ct] of files) {
    const url = await upload(local, obj, ct);
    console.log(`${path.basename(local)} → ${url}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
