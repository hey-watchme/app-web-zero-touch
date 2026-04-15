import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

const FALLBACK_DEVICE_ID = "amical-db-test";

type TopicRow = {
  id: string;
  start_at: string | null;
  final_title: string | null;
};

type FactRow = {
  id: string;
  topic_id: string;
  fact_text: string;
  importance_level: number | null;
  categories: string[] | null;
  intents: string[] | null;
  ttl_type: string | null;
  created_at: string;
};

type WikiRow = {
  id: string;
  title: string;
  body: string;
  theme: string | null;
  kind: string | null;
  status: string | null;
  version: number | null;
  source_fact_ids: string[] | null;
  last_ingest_at: string | null;
  created_at: string;
  updated_at: string;
};

function resolveDeviceId(request: NextRequest) {
  return (
    request.nextUrl.searchParams.get("device_id") ??
    process.env.ZEROTOUCH_DEVICE_ID ??
    FALLBACK_DEVICE_ID
  );
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServer();
  const deviceId = resolveDeviceId(request);

  const { data: topicRows, error: topicError } = await supabase
    .from("zerotouch_conversation_topics")
    .select("id, start_at, final_title")
    .eq("device_id", deviceId)
    .not("start_at", "is", null)
    .order("start_at", { ascending: true });

  if (topicError) {
    return NextResponse.json(
      { error: topicError.message },
      { status: 500 },
    );
  }

  const topics = (topicRows ?? []) as TopicRow[];
  const topicIds = topics.map((topic) => topic.id);
  const topicMap = new Map(topics.map((topic) => [topic.id, topic]));

  let facts: Array<
    FactRow & {
      topic_start_at: string | null;
      topic_title: string | null;
      date_key: string | null;
    }
  > = [];

  if (topicIds.length > 0) {
    const chunkSize = 200;
    for (let index = 0; index < topicIds.length; index += chunkSize) {
      const chunk = topicIds.slice(index, index + chunkSize);
      const { data: factRows, error: factError } = await supabase
        .from("zerotouch_facts")
        .select("id, topic_id, fact_text, importance_level, categories, intents, ttl_type, created_at")
        .in("topic_id", chunk)
        .order("created_at", { ascending: false });

      if (factError) {
        return NextResponse.json(
          { error: factError.message },
          { status: 500 },
        );
      }

      const mappedFacts = ((factRows ?? []) as FactRow[]).map((fact) => {
        const topic = topicMap.get(fact.topic_id);
        const dateKey = topic?.start_at?.slice(0, 10) ?? null;
        return {
          ...fact,
          topic_start_at: topic?.start_at ?? null,
          topic_title: topic?.final_title ?? null,
          date_key: dateKey,
        };
      });
      facts = facts.concat(mappedFacts);
    }
  }

  let wikiPages: WikiRow[] = [];
  let wikiAvailable = true;

  const { data: wikiRows, error: wikiError } = await supabase
    .from("zerotouch_wiki_pages")
    .select("id, title, body, theme, kind, status, version, source_fact_ids, last_ingest_at, created_at, updated_at")
    .eq("device_id", deviceId)
    .order("updated_at", { ascending: false });

  if (wikiError) {
    if (wikiError.code === "42P01") {
      wikiAvailable = false;
    } else {
      return NextResponse.json(
        { error: wikiError.message },
        { status: 500 },
      );
    }
  } else {
    wikiPages = (wikiRows ?? []) as WikiRow[];
  }

  return NextResponse.json({
    deviceId,
    facts,
    wikiPages,
    wikiAvailable,
  });
}
