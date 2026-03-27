import { NextRequest, NextResponse } from "next/server";

const DEFAULT_API_BASE_URL = "https://api.hey-watch.me/zerotouch";

function resolveApiBaseUrl() {
  return (
    process.env.ZEROTOUCH_API_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_API_BASE_URL
  );
}

export async function GET(request: NextRequest) {
  const upstreamUrl = new URL(`${resolveApiBaseUrl()}/api/topics`);
  const searchParams = request.nextUrl.searchParams;

  upstreamUrl.searchParams.set(
    "limit",
    searchParams.get("limit") ?? "40",
  );
  upstreamUrl.searchParams.set(
    "offset",
    searchParams.get("offset") ?? "0",
  );
  upstreamUrl.searchParams.set(
    "include_children",
    searchParams.get("include_children") ?? "true",
  );

  const deviceId = searchParams.get("device_id");
  const status = searchParams.get("status");

  if (deviceId) {
    upstreamUrl.searchParams.set("device_id", deviceId);
  }

  if (status) {
    upstreamUrl.searchParams.set("status", status);
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
