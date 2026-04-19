import { NextRequest, NextResponse } from "next/server";

const DEFAULT_API_BASE_URL = "https://api.hey-watch.me/zerotouch";

function resolveApiBaseUrl() {
  return (
    process.env.ZEROTOUCH_API_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_API_BASE_URL
  );
}

export async function POST(request: NextRequest) {
  const upstreamUrl = new URL(`${resolveApiBaseUrl()}/api/query-wiki`);
  const body = await request.text();

  const response = await fetch(upstreamUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  const bodyText = await response.text();
  return new NextResponse(bodyText, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/json",
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
