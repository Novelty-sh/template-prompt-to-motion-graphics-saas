import { COMP_NAME } from "../../../../../types/constants";
import { ASPECT_RATIOS } from "../../../../types/generation";
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

  const arConfig = ASPECT_RATIOS.find((ar) => ar.id === body.aspectRatio) ?? ASPECT_RATIOS[0];

  const res = await fetch(`${backendUrl}/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      compositionId: COMP_NAME,
      inputProps: body.inputProps,
      codec: "h264",
      siteName: "novelty-saas",
      forceWidth: arConfig.width,
      forceHeight: arConfig.height,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { type: "error", message: `Render backend error: ${text}` },
      { status: res.status },
    );
  }

  const data = await res.json();
  return NextResponse.json({ type: "success", data });
}
