/**
 * DB-based data source for the stateful viewer.
 * Reads from zerotouch_conversation_topics + zerotouch_facts (Supabase).
 *
 * Date grouping uses topic.start_at (= actual conversation date),
 * NOT topic.created_at (= pipeline processing date).
 */

import type {
  StatefulArtifactsBundle,
  DailyRollup,
  DailyTask,
  DailyKnowledge,
  ActiveStateSnapshot,
} from "./stateful-artifacts";
import { createSupabaseServer } from "./supabase-server";

const FALLBACK_DEVICE_ID = "amical-db-test";

type DbTopic = {
  id: string;
  final_title: string | null;
  final_summary: string | null;
  importance_level: number | null;
  start_at: string | null;
  distillation_status: string | null;
};

type DbFact = {
  id: string;
  topic_id: string;
  fact_text: string;
  importance_level: number | null;
  categories: string[] | null;
  intents: string[] | null;
  ttl_type: string | null;
  entities: unknown[] | null;
  expires_at: string | null;
  created_at: string;
};

export async function loadStatefulArtifactsFromDB(
  date?: string | null,
  deviceId?: string | null,
): Promise<StatefulArtifactsBundle> {
  const supabase = createSupabaseServer();
  const targetDevice = deviceId ?? process.env.ZEROTOUCH_DEVICE_ID ?? FALLBACK_DEVICE_ID;

  // Fetch all scored topics — use start_at for date grouping (= actual conversation date)
  const { data: topicsData } = await supabase
    .from("zerotouch_conversation_topics")
    .select("id, final_title, final_summary, importance_level, start_at, distillation_status")
    .eq("device_id", targetDevice)
    .not("importance_level", "is", null)
    .not("start_at", "is", null)
    .order("start_at", { ascending: true });

  const allTopics: DbTopic[] = topicsData ?? [];

  // Available dates derived from start_at (YYYY-MM-DD in local time via UTC slice)
  const dateSet = new Set(
    allTopics
      .map((t) => t.start_at?.slice(0, 10))
      .filter((d): d is string => Boolean(d)),
  );
  const availableDates = [...dateSet].sort();

  const selectedDate =
    date && availableDates.includes(date)
      ? date
      : (availableDates[availableDates.length - 1] ?? null);

  if (!selectedDate) {
    return {
      availableDates,
      selectedDate: null,
      baseDaily: null,
      contextBundle: null,
      statefulDaily: null,
      stateDelta: null,
      activeStateSnapshot: null,
    };
  }

  // Topics whose conversation started on the selected date
  const dateTopics = allTopics.filter((t) => t.start_at?.startsWith(selectedDate));
  const topicIds = dateTopics.map((t) => t.id);

  // Fetch facts joined by topic_id (date-independent)
  let facts: DbFact[] = [];
  if (topicIds.length > 0) {
    const { data: factsData } = await supabase
      .from("zerotouch_facts")
      .select("id, topic_id, fact_text, importance_level, categories, intents, ttl_type, entities, expires_at, created_at")
      .in("topic_id", topicIds)
      .order("created_at", { ascending: true });
    facts = factsData ?? [];
  }

  // --- Map facts to viewer types ---

  const ephemeralFacts = facts.filter((f) => f.ttl_type === "ephemeral");
  const durableFacts = facts.filter(
    (f) => f.ttl_type === "permanent" || f.ttl_type === "seasonal",
  );
  const decisionFacts = facts.filter((f) => (f.intents ?? []).includes("指示"));

  const activeTasks: DailyTask[] = ephemeralFacts.map((f) => ({
    task_id: f.id,
    title: f.fact_text.slice(0, 60),
    summary: f.fact_text,
    priority: (f.importance_level ?? 0) >= 4 ? "high" : "normal",
    status: "open",
  }));

  const durableKnowledge: (DailyKnowledge & { last_confirmed_at?: string })[] = durableFacts.map(
    (f) => ({
      knowledge_id: f.id,
      title: f.fact_text.slice(0, 60),
      summary: f.fact_text,
      category: (f.categories ?? [])[0] ?? "general",
      status: "active",
      last_confirmed_at: f.created_at,
    }),
  );

  const decisionLog = decisionFacts.map((f) => ({
    decision_id: f.id,
    statement: f.fact_text,
    status: "decided",
    last_confirmed_at: f.created_at,
    source_refs: f.topic_id ? [f.topic_id] : undefined,
  }));

  // --- Build DailyRollup (baseDaily) ---

  const highTopics = dateTopics.filter((t) => (t.importance_level ?? 0) >= 4);
  const abstract =
    highTopics
      .slice(0, 5)
      .map((t) => t.final_summary)
      .filter(Boolean)
      .join(" / ") || `${dateTopics.length} 件のトピックを記録。`;

  const baseDaily: DailyRollup = {
    date: selectedDate,
    headline: `${selectedDate} の会話ログ (${dateTopics.length} topics / ${facts.length} facts)`,
    abstract,
    status_summary:
      `Lv.4+: ${dateTopics.filter((t) => (t.importance_level ?? 0) >= 4).length} topics` +
      ` / Lv.3: ${dateTopics.filter((t) => t.importance_level === 3).length} topics` +
      ` / Lv.2以下: ${dateTopics.filter((t) => (t.importance_level ?? 0) <= 2).length} topics` +
      ` / 総 Facts: ${facts.length}`,
    knowledge_refs: durableFacts.map((f) => ({
      knowledge_id: f.id,
      title: f.fact_text.slice(0, 60),
      summary: f.fact_text,
      category: (f.categories ?? [])[0] ?? "general",
    })),
    decisions: decisionFacts.map((f) => ({ summary: f.fact_text })),
    open_tasks: ephemeralFacts.map((f) => ({
      task_id: f.id,
      title: f.fact_text.slice(0, 60),
      summary: f.fact_text,
      priority: (f.importance_level ?? 0) >= 4 ? "high" : "normal",
    })),
  };

  const activeStateSnapshot: ActiveStateSnapshot = {
    date: selectedDate,
    generated_at: new Date().toISOString(),
    active_tasks: activeTasks,
    decision_log: decisionLog,
    durable_knowledge: durableKnowledge,
  };

  return {
    availableDates,
    selectedDate,
    baseDaily,
    contextBundle: null,
    statefulDaily: null,
    stateDelta: null,
    activeStateSnapshot,
  };
}
