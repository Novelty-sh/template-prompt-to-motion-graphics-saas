/**
 * Upload images to GCS via presigned URLs from the Novelty Studio backend.
 *
 * Flow:
 * 1. POST /generate-upload-url → get presigned PUT URL + public URL
 * 2. PUT raw binary to presigned URL
 * 3. Return public CDN URL
 */

const STUDIO_BACKEND_URL =
  process.env.NODE_ENV === "development"
    ? "https://novelty-studio-backend-602800012416.asia-south1.run.app"
    : "https://novelty-studio-backend-602800012416.asia-south1.run.app";

const BUCKET_NAME = "novelty-public-videos";
const PRESIGN_TIMEOUT_MS = 15_000;

/** Convert a base64 data URL to a Blob + extract content type. */
function dataUrlToBlob(dataUrl: string): { blob: Blob; contentType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("Invalid base64 data URL");

  const contentType = match[1];
  const raw = atob(match[2]);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

  return { blob: new Blob([bytes], { type: contentType }), contentType };
}

/** Map content type to file extension. */
function extFromContentType(ct: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[ct] || "png";
}

/** Upload a single base64 image to GCS via presigned URL. Returns the public URL. */
async function uploadOne(
  base64DataUrl: string,
  filePath: string,
): Promise<string> {
  const { blob, contentType } = dataUrlToBlob(base64DataUrl);

  // 1. Get presigned URL
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PRESIGN_TIMEOUT_MS);

  let presignRes: Response;
  try {
    presignRes = await fetch(`${STUDIO_BACKEND_URL}/generate-upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        file_path: filePath,
        content_type: contentType,
        expiration_minutes: 15,
        bucket_name: BUCKET_NAME,
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!presignRes.ok) {
    const err = await presignRes.json().catch(() => ({}));
    throw new Error(
      err.error || err.detail || `Presign failed (${presignRes.status})`,
    );
  }

  const { upload_url, public_url } = await presignRes.json();

  // 2. PUT binary to presigned URL
  const uploadRes = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: blob,
  });

  if (!uploadRes.ok) {
    throw new Error(`GCS upload failed (${uploadRes.status})`);
  }

  return public_url;
}

/**
 * Upload an array of base64 images to GCS in parallel via presigned URLs.
 * Returns array of public URLs in the same order.
 */
export async function uploadImagesToGCS(
  base64Images: string[],
  sessionId: string,
): Promise<string[]> {
  const timestamp = Date.now();

  return Promise.all(
    base64Images.map(async (dataUrl, i) => {
      const { contentType } = dataUrlToBlob(dataUrl);
      const ext = extFromContentType(contentType);
      const filePath = `motion-graphics/images/${sessionId}/${timestamp}-${i + 1}.${ext}`;
      return uploadOne(dataUrl, filePath);
    }),
  );
}
