import { NextResponse } from "next/server";

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^0\./,
  /^\[?::1\]?$/i,
];

export async function GET(request: Request) {
  const rawUrl = new URL(request.url).searchParams.get("url");
  if (!rawUrl) {
    return NextResponse.json({ error: "Missing image url" }, { status: 400 });
  }

  let imageUrl: URL;
  try {
    imageUrl = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid image url" }, { status: 400 });
  }

  if (imageUrl.protocol !== "https:" || isBlockedHost(imageUrl.hostname)) {
    return NextResponse.json({ error: "Unsupported image url" }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(imageUrl, {
      headers: {
        accept: "image/avif,image/webp,image/png,image/jpeg,image/*",
        "user-agent": "DygoImageProxy/1.0",
      },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return NextResponse.json({ error: "Image fetch failed" }, { status: 502 });
  }

  if (!response.ok || !response.body) {
    return NextResponse.json({ error: "Image fetch failed" }, { status: 502 });
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "URL is not an image" }, { status: 415 });
  }

  return new NextResponse(response.body, {
    headers: {
      "content-type": contentType,
      "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}

function isBlockedHost(hostname: string) {
  return PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
}
