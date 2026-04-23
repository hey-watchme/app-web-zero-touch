import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

const MAX_FACT_IDS = 200;
const FACT_CHUNK_SIZE = 100;

type FactRow = {
  id: string;
  topic_id: string;
  fact_text: string;
  importance_level: number | null;
  categories: string[] | null;
  ttl_type: string | null;
  created_at: string;
};

function parseFactIds(request: NextRequest): string[] {
  const searchParams = request.nextUrl.searchParams;
  const singleParams = searchParams.getAll("id");
  const listParam = searchParams.get("ids") ?? "";

  const ids = [
    ...singleParams,
    ...listParam.split(","),
  ]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return [...new Set(ids)].slice(0, MAX_FACT_IDS);
}

function resolveDeviceId(request: NextRequest): string | null {
  return (
    request.nextUrl.searchParams.get("device_id") ??
    process.env.ZEROTOUCH_DEVICE_ID ??
    null
  );
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServer();
  const factIds = parseFactIds(request);
  const deviceId = resolveDeviceId(request);

  if (factIds.length === 0) {
    return NextResponse.json({ facts: [] });
  }

  let facts: FactRow[] = [];

  for (let index = 0; index < factIds.length; index += FACT_CHUNK_SIZE) {
    const chunk = factIds.slice(index, index + FACT_CHUNK_SIZE);
    let query = supabase
      .from("zerotouch_facts")
      .select("id, topic_id, fact_text, importance_level, categories, ttl_type, created_at")
      .in("id", chunk);

    if (deviceId) {
      query = query.eq("device_id", deviceId);
    }

    const { data: factRows, error: factError } = await query;
    if (factError) {
      return NextResponse.json({ error: factError.message }, { status: 500 });
    }
    facts = facts.concat((factRows ?? []) as FactRow[]);
  }

  return NextResponse.json({ facts });
}
