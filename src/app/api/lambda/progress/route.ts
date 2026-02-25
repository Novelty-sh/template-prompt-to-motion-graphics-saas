import type { ProgressResponse } from "../../../../../types/schema";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const backendUrl = process.env.REMOTION_BACKEND_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { type: "error", message: "REMOTION_BACKEND_URL is not set." },
      { status: 500 },
    );
  }

  const body = await req.json();

  const res = await fetch(`${backendUrl}/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucketName: body.bucketName,
      renderId: body.id,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { type: "error", message: `Progress backend error: ${text}` },
      { status: res.status },
    );
  }

  // Backend returns { type: "success", data: { type: "in-progress"|"done"|"error", ... } }
  // Unwrap and normalize to internal ProgressResponse format
  const response = await res.json();
  const raw = response?.data ?? response;

  let normalized: ProgressResponse;

  if (raw.type === "in-progress") {
    normalized = { type: "progress", progress: raw.overallProgress ?? 0 };
  } else if (raw.type === "done") {
    normalized = {
      type: "done",
      url: raw.outputFile,
      size: raw.outputSizeInBytes ?? 0,
    };
  } else if (raw.type === "error") {
    normalized = { type: "error", message: raw.error ?? raw.message ?? "Render failed" };
  } else {
    // Unexpected shape — surface as error so the loop terminates
    normalized = { type: "error", message: `Unexpected progress response: ${JSON.stringify(raw)}` };
  }

  return NextResponse.json({ type: "success", data: normalized });
}
