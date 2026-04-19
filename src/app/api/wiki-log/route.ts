import { NextRequest, NextResponse } from "next/server";

const DEFAULT_API_BASE_URL = "https://api.hey-watch.me/zerotouch";

function resolveApiBaseUrl() {
  return (
    process.env.ZEROTOUCH_API_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_API_BASE_URL
  );
}

export async function GET(request: NextRequest) {
  const upstreamUrl = new URL(`${resolveApiBaseUrl()}/api/wiki-log`);
  const searchParams = request.nextUrl.searchParams;

  const deviceId =
    searchParams.get("device_id") ?? process.env.ZEROTOUCH_DEVICE_ID ?? null;
  const operation = searchParams.get("operation");
  const limit = searchParams.get("limit");

  if (deviceId) {
    upstreamUrl.searchParams.set("device_id", deviceId);
  }

  if (operation) {
    upstreamUrl.searchParams.set("operation", operation);
  }

  if (limit) {
    upstreamUrl.searchParams.set("limit", limit);
  }

  const response = await fetch(upstreamUrl, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
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
