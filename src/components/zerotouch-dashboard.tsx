"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import useSWR from "swr";
import {
  BookOpenText,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  MessageCircleQuestion,
  Radio,
  Search,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";

type TopicStatus = "active" | "cooling" | "finalized" | "failed" | string;

type TopicUtterance = {
  id: string;
  topic_id?: string | null;
  device_id: string;
  status: string;
  transcription?: string | null;
  transcription_metadata?: {
    provider?: string;
    model?: string;
    language?: string;
  } | null;
  duration_seconds?: number | null;
  recorded_at?: string | null;
  created_at: string;
  updated_at: string;
};

type Topic = {
  id: string;
  device_id: string;
  topic_status: TopicStatus;
  live_title?: string | null;
  live_summary?: string | null;
  final_title?: string | null;
  final_summary?: string | null;
  utterance_count?: number | null;
  llm_provider?: string | null;
  llm_model?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  last_utterance_at?: string | null;
  updated_at?: string | null;
  utterances: TopicUtterance[];
};

type TopicsResponse = {
  topics: Topic[];
  count: number;
};

type FactRecord = {
  id: string;
  topic_id: string;
  fact_text: string;
  importance_level: number | null;
  categories: string[] | null;
  intents: string[] | null;
  ttl_type: string | null;
  created_at: string;
  topic_start_at: string | null;
  topic_title: string | null;
  date_key: string | null;
};

type WikiPageRecord = {
  id: string;
  title: string;
  body: string;
  project_id: string | null;
  project_key: string | null;
  project_name: string | null;
  category: string | null;
  page_key: string | null;
  kind: string | null;
  status: string | null;
  version: number | null;
  source_fact_ids: string[] | null;
  last_ingest_at: string | null;
  created_at: string;
  updated_at: string;
};

type PipelineBoardResponse = {
  deviceId: string;
  facts: FactRecord[];
  wikiPages: WikiPageRecord[];
  wikiAvailable: boolean;
};

type FilterKey = "all" | "finalized";
type PhaseKey = "raw" | "facts" | "wiki";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "すべて" },
  { key: "finalized", label: "完了" },
];

const TOPICS_PAGE_SIZE = 200;
const MAX_TOPIC_PAGES = 20;
const EMPTY_TOPICS: Topic[] = [];
const EMPTY_FACTS: FactRecord[] = [];
const EMPTY_WIKI_PAGES: WikiPageRecord[] = [];

async function topicsFetcher(url: string): Promise<TopicsResponse> {
  const baseUrl = new URL(url, window.location.origin);
  const limit = Number(baseUrl.searchParams.get("limit") ?? String(TOPICS_PAGE_SIZE));
  let offset = Number(baseUrl.searchParams.get("offset") ?? "0");
  const dedupedTopics = new Map<string, Topic>();

  for (let page = 0; page < MAX_TOPIC_PAGES; page += 1) {
    const pageUrl = new URL(baseUrl);
    pageUrl.searchParams.set("limit", String(limit));
    pageUrl.searchParams.set("offset", String(offset));

    const response = await fetch(pageUrl, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch topics: ${response.status}`);
    }

    const body = (await response.json()) as TopicsResponse;
    const pageTopics = body.topics ?? [];

    pageTopics.forEach((topic) => {
      dedupedTopics.set(topic.id, topic);
    });

    if (pageTopics.length < limit) {
      break;
    }

    offset += limit;
  }

  const topics = [...dedupedTopics.values()].sort(
    (left, right) => resolveTopicSortTime(right) - resolveTopicSortTime(left),
  );

  return {
    topics,
    count: topics.length,
  };
}

async function jsonFetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function ZerotouchDashboard() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [activePhase, setActivePhase] = useState<PhaseKey>("raw");
  const [query, setQuery] = useState("");
  const [selectedDate, setSelectedDate] = useState(() => getTodayDateKey());
  const [calendarMonth, setCalendarMonth] = useState(() => firstDayOfMonthKey(getTodayDateKey()));
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());
  const todayKey = getTodayDateKey();

  const {
    data: topicsData,
    error: topicsError,
    isLoading: isTopicsLoading,
  } = useSWR<TopicsResponse>(
    `/api/topics?limit=${TOPICS_PAGE_SIZE}&include_children=true`,
    topicsFetcher,
    {
      refreshInterval: 2500,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );

  const {
    data: pipelineData,
    error: pipelineError,
    isLoading: isPipelineLoading,
  } = useSWR<PipelineBoardResponse>(
    "/api/pipeline-board",
    jsonFetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );

  const topics = topicsData?.topics ?? EMPTY_TOPICS;
  const facts = pipelineData?.facts ?? EMPTY_FACTS;
  const wikiPages = pipelineData?.wikiPages ?? EMPTY_WIKI_PAGES;
  const wikiAvailable = pipelineData?.wikiAvailable ?? true;
  const selectedDayTopics = useMemo(
    () => topics.filter((topic) => resolveTopicDateKey(topic) === selectedDate),
    [selectedDate, topics],
  );
  const selectedDayUtterances = selectedDayTopics.reduce(
    (count, topic) => count + (topic.utterance_count ?? topic.utterances.length),
    0,
  );
  const selectedDayFacts = useMemo(
    () =>
      facts
        .filter((fact) => fact.date_key === selectedDate)
        .sort((left, right) => resolveIsoSortTime(right.created_at) - resolveIsoSortTime(left.created_at)),
    [facts, selectedDate],
  );
  const selectedFactIds = useMemo(
    () => new Set(selectedDayFacts.map((fact) => fact.id)),
    [selectedDayFacts],
  );
  const selectedDayWikiPages = useMemo(() => {
    return wikiPages
      .filter((page) => {
        const sourceFactIds = page.source_fact_ids ?? [];
        if (sourceFactIds.some((factId) => selectedFactIds.has(factId))) {
          return true;
        }

        const ingestDateKey = toDateKey(page.last_ingest_at ?? page.updated_at ?? page.created_at);
        return sourceFactIds.length === 0 && ingestDateKey === selectedDate;
      })
      .sort((left, right) => resolveWikiSortTime(right) - resolveWikiSortTime(left));
  }, [selectedDate, selectedFactIds, wikiPages]);

  const filteredTopics = useMemo(() => {
    return selectedDayTopics.filter((topic) => {
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "finalized" && topic.topic_status === "finalized");

      if (!matchesFilter) {
        return false;
      }

      if (!deferredQuery) {
        return true;
      }

      return buildRawHaystack(topic).includes(deferredQuery);
    });
  }, [activeFilter, deferredQuery, selectedDayTopics]);

  const filteredFacts = useMemo(() => {
    return selectedDayFacts.filter((fact) => {
      if (!deferredQuery) {
        return true;
      }

      return buildFactHaystack(fact).includes(deferredQuery);
    });
  }, [deferredQuery, selectedDayFacts]);

  const filteredWikiPages = useMemo(() => {
    return selectedDayWikiPages.filter((page) => {
      if (!deferredQuery) {
        return true;
      }

      return buildWikiHaystack(page).includes(deferredQuery);
    });
  }, [deferredQuery, selectedDayWikiPages]);

  const availableDates = useMemo(() => {
    const dates = new Set<string>([todayKey]);

    topics.forEach((topic) => {
      const dateKey = resolveTopicDateKey(topic);
      if (dateKey) {
        dates.add(dateKey);
      }
    });

    facts.forEach((fact) => {
      if (fact.date_key) {
        dates.add(fact.date_key);
      }
    });

    return [...dates].sort();
  }, [facts, todayKey, topics]);

  const availableDateSet = useMemo(() => new Set(availableDates), [availableDates]);
  const earliestDate = availableDates[0] ?? todayKey;
  const canGoPrev = selectedDate > earliestDate;
  const canGoNext = selectedDate < todayKey;
  const previousDateLabel = canGoPrev ? formatShortDateLabel(addDays(selectedDate, -1)) : "これ以上前はありません";
  const nextDateLabel = canGoNext ? formatShortDateLabel(addDays(selectedDate, 1)) : "本日";
  const selectedDateLabel = formatSelectedDateLabel(selectedDate, todayKey);
  const selectedDateCaption = formatLongDateLabel(selectedDate);
  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonth, availableDateSet, selectedDate, todayKey),
    [availableDateSet, calendarMonth, selectedDate, todayKey],
  );
  const isLoading = isTopicsLoading || isPipelineLoading;
  const error = topicsError ?? pipelineError;
  const lastSyncAt = topicsData || pipelineData ? new Date() : null;

  const phaseCounts = {
    raw: selectedDayTopics.length,
    facts: selectedDayFacts.length,
    wiki: selectedDayWikiPages.length,
  };

  const phaseMeta = {
    raw: {
      eyebrow: "Raw Sources",
      title: `${selectedDateCaption}の会話ログ`,
      description: `カード ${selectedDayUtterances} 件 / トピック ${selectedDayTopics.length} 件。発話の生データから Topic になるまでをそのまま見ます。`,
    },
    facts: {
      eyebrow: "Facts",
      title: `${selectedDateCaption}から抽出された Fact`,
      description: `Annotation 済みの Fact ${selectedDayFacts.length} 件。Topic から構造化された知識候補を見ます。`,
    },
    wiki: {
      eyebrow: "Wiki",
      title: `${selectedDateCaption}に育った wiki page`,
      description: `その日の Fact を取り込んだ wiki page ${selectedDayWikiPages.length} 件。最終的に知識面に残る形を見ます。`,
    },
  }[activePhase];

  function handleSelectDate(dateKey: string) {
    setSelectedDate(dateKey);
    setCalendarMonth(firstDayOfMonthKey(dateKey));
    setIsCalendarOpen(false);
  }

  return (
    <main className="min-h-dvh bg-[var(--zt-background)] px-4 py-4 text-[var(--zt-foreground)] sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <section className="rounded-[28px] border border-[var(--zt-outline)] bg-[var(--zt-surface)] px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-[var(--zt-surface-strong)] px-3 py-1 text-xs font-semibold text-[var(--zt-muted-strong)]">
                  <Radio className="size-3.5 text-[var(--zt-primary)]" />
                  ZeroTouch Knowledge Pipeline Board
                </div>
                <div className="space-y-1">
                  <h1 className="max-w-3xl text-balance text-[2rem] font-semibold leading-tight sm:text-[2.5rem]">
                    雑談が knowledge base になるまでを、同じ日付軸で追う。
                  </h1>
                  <p className="max-w-3xl text-pretty text-sm leading-6 text-[var(--zt-muted)] sm:text-[15px]">
                    Raw Sources から Fact、Ingest、Wiki までをタブで切り替え、同じ日のデータがどう上流に変換されるかを見ます。
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/wiki"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--zt-primary-soft)] bg-[var(--zt-primary-pale)] px-4 py-2 text-sm font-medium text-[var(--zt-primary)] hover:bg-[var(--zt-primary-soft)]"
                  >
                    Wiki Explorer
                    <BookOpenText className="size-4" />
                  </Link>
                  <Link
                    href="/stateful"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-2 text-sm font-medium text-[var(--zt-foreground)] hover:bg-[var(--zt-surface-strong)]"
                  >
                    All-in-one
                    <Sparkles className="size-4 text-[var(--zt-primary)]" />
                  </Link>
                  <Link
                    href="/stateful/timeline"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-2 text-sm font-medium text-[var(--zt-foreground)] hover:bg-[var(--zt-surface-strong)]"
                  >
                    Timeline
                    <Clock3 className="size-4 text-[var(--zt-primary)]" />
                  </Link>
                  <Link
                    href="/query"
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-2 text-sm font-medium text-[var(--zt-foreground)] hover:bg-[var(--zt-surface-strong)]"
                  >
                    Query
                    <MessageCircleQuestion className="size-4 text-[var(--zt-primary)]" />
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard icon={Clock3} label="カード" value={selectedDayUtterances} tone="primary" />
                <StatCard icon={BookOpenText} label="Fact" value={selectedDayFacts.length} tone="neutral" />
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-3">
                <Search className="size-4 shrink-0 text-[var(--zt-muted)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={resolveSearchPlaceholder(activePhase)}
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--zt-foreground)] outline-none placeholder:text-[var(--zt-muted)]"
                />
              </label>

              {activePhase === "raw" ? (
                <div className="min-w-0 overflow-x-auto">
                  <div className="flex min-w-max items-center gap-2">
                    {FILTERS.map((filter) => (
                      <button
                        key={filter.key}
                        type="button"
                        onClick={() => setActiveFilter(filter.key)}
                        className={cn(
                          "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                          activeFilter === filter.key
                            ? "border-[var(--zt-primary-soft)] bg-[var(--zt-primary-pale)] text-[var(--zt-primary)]"
                            : "border-[var(--zt-outline)] bg-[var(--zt-surface)] text-[var(--zt-muted-strong)] hover:bg-[var(--zt-surface-strong)]",
                        )}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--zt-muted)]">
                  {activePhase === "facts"
                    ? "Topic から抽出された Fact を検索します。"
                    : "最終的な wiki page の本文と project/category/page_key を検索します。"}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 text-sm text-[var(--zt-muted)] sm:flex-row sm:items-center sm:justify-between">
              <div className="inline-flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex size-2.5 rounded-full",
                    isLoading
                      ? "bg-amber-400"
                      : error
                        ? "bg-rose-500"
                        : "bg-emerald-500",
                  )}
                />
                {error
                  ? "同期エラー"
                  : isLoading
                    ? "初回同期中"
                    : "Raw は 2.5 秒、下流フェーズは 5 秒ごとに同期"}
              </div>
              <div className="inline-flex items-center gap-2">
                <LoaderCircle
                  className={cn(
                    "size-4",
                    isLoading ? "animate-spin text-[var(--zt-primary)]" : "text-[var(--zt-muted)]",
                  )}
                />
                最終更新 {lastSyncAt ? formatSyncTime(lastSyncAt) : "--:--:--"}
              </div>
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-[24px] border border-rose-200 bg-rose-50 px-5 py-5 text-sm text-rose-700">
            データソースに接続できませんでした。`ZEROTOUCH_API_BASE_URL` または Supabase 接続設定を確認してください。
          </section>
        ) : null}

        <section className="rounded-[28px] border border-[var(--zt-outline)] bg-[var(--zt-surface)] px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-[var(--zt-muted)]">{phaseMeta.eyebrow}</p>
                <h2 className="text-balance text-2xl font-semibold text-[var(--zt-foreground)]">
                  {selectedDateLabel}
                </h2>
                <p className="text-pretty text-sm text-[var(--zt-muted)]">{phaseMeta.description}</p>
              </div>

              <div className="flex flex-col gap-2 sm:items-end">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleSelectDate(addDays(selectedDate, -1))}
                    disabled={!canGoPrev}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
                      canGoPrev
                        ? "border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] text-[var(--zt-foreground)] hover:bg-[var(--zt-surface-strong)]"
                        : "border-[var(--zt-outline)] bg-[var(--zt-surface)] text-[var(--zt-muted)] opacity-50",
                    )}
                  >
                    <ChevronLeft className="size-4" />
                    {previousDateLabel}
                  </button>
                  <button
                    type="button"
                    aria-label="日付カレンダーを開く"
                    aria-expanded={isCalendarOpen}
                    onClick={() => {
                      setCalendarMonth(firstDayOfMonthKey(selectedDate));
                      setIsCalendarOpen((open) => !open);
                    }}
                    className="inline-flex items-center gap-2 rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-2 text-sm font-medium text-[var(--zt-foreground)] hover:bg-[var(--zt-surface-strong)]"
                  >
                    <CalendarDays className="size-4 text-[var(--zt-primary)]" />
                    カレンダー
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectDate(addDays(selectedDate, 1))}
                    disabled={!canGoNext}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
                      canGoNext
                        ? "border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] text-[var(--zt-foreground)] hover:bg-[var(--zt-surface-strong)]"
                        : "border-[var(--zt-outline)] bg-[var(--zt-surface)] text-[var(--zt-muted)] opacity-50",
                    )}
                  >
                    {nextDateLabel}
                    <ChevronRight className="size-4" />
                  </button>
                </div>
                <p className="text-sm text-[var(--zt-muted)]">
                  左右で日付を移動し、必要ならカレンダーからデータのある日を選びます。
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  { key: "raw", label: "Raw Sources" },
                  { key: "facts", label: "Facts" },
                  { key: "wiki", label: "Wiki" },
                ] as Array<{ key: PhaseKey; label: string }>
              ).map((phase) => {
                const isActive = phase.key === activePhase;
                return (
                  <button
                    key={phase.key}
                    type="button"
                    onClick={() => setActivePhase(phase.key)}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium",
                      isActive
                        ? "border-[var(--zt-primary-soft)] bg-[var(--zt-primary-pale)] text-[var(--zt-primary)]"
                        : "border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] text-[var(--zt-muted-strong)] hover:bg-[var(--zt-surface-strong)]",
                    )}
                  >
                    {phase.label}
                    <span className="tabular-nums text-xs opacity-80">{phaseCounts[phase.key]}</span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-[24px] border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-4">
              <h3 className="text-balance text-lg font-semibold text-[var(--zt-foreground)]">
                {phaseMeta.title}
              </h3>
              <p className="mt-1 text-pretty text-sm leading-6 text-[var(--zt-muted)]">
                Raw Sources から Facts、Ingest、Wiki へ進むほど、雑談が構造化されて長期記憶に近づきます。
              </p>
            </div>

            {isCalendarOpen ? (
              <div className="rounded-[24px] border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    aria-label="前の月を表示"
                    onClick={() => setCalendarMonth(addMonths(calendarMonth, -1))}
                    className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface)] text-[var(--zt-foreground)] hover:bg-[var(--zt-surface-strong)]"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-[var(--zt-foreground)]">
                      {formatMonthLabel(calendarMonth)}
                    </p>
                    <p className="text-sm text-[var(--zt-muted)]">
                      データあり {availableDates.filter((date) => date.startsWith(calendarMonth.slice(0, 7))).length} 日
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="次の月を表示"
                    onClick={() => setCalendarMonth(addMonths(calendarMonth, 1))}
                    className="inline-flex size-10 items-center justify-center rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface)] text-[var(--zt-foreground)] hover:bg-[var(--zt-surface-strong)]"
                  >
                    <ChevronRight className="size-4" />
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-[var(--zt-muted)]">
                  {["日", "月", "火", "水", "木", "金", "土"].map((day) => (
                    <div key={day} className="py-1">
                      {day}
                    </div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-2">
                  {calendarDays.map((day) => {
                    if (!day.dateKey) {
                      return <div key={day.key} className="min-h-14 rounded-2xl" />;
                    }

                    const dateKey = day.dateKey;

                    return (
                      <button
                        key={dateKey}
                        type="button"
                        disabled={day.isFuture}
                        onClick={() => handleSelectDate(dateKey)}
                        className={cn(
                          "flex min-h-14 flex-col items-center justify-center rounded-2xl border px-2 py-2 text-sm font-medium",
                          day.isSelected
                            ? "border-[var(--zt-primary-soft)] bg-[var(--zt-primary-pale)] text-[var(--zt-primary)]"
                            : day.hasData
                              ? "border-[var(--zt-outline)] bg-[var(--zt-surface)] text-[var(--zt-foreground)] hover:bg-[var(--zt-surface-strong)]"
                              : "border-[var(--zt-outline)] bg-[var(--zt-surface)] text-[var(--zt-muted)] hover:bg-[var(--zt-surface-strong)]",
                          day.isFuture && "opacity-40",
                        )}
                      >
                        <span className="tabular-nums">{day.day}</span>
                        <span
                          className={cn(
                            "mt-1 size-1.5 rounded-full",
                            day.hasData ? "bg-[var(--zt-primary)]" : "bg-transparent",
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {isLoading && !topicsData && !pipelineData ? (
          <DashboardSkeleton />
        ) : activePhase === "raw" ? (
          filteredTopics.length === 0 ? (
            <PhaseEmptyState
              title={`${selectedDateLabel}に表示できるトピックはまだありません。`}
              body="日付を移動すると、過去に取り込まれたカードとトピックを確認できます。"
            />
          ) : (
            <section className="space-y-3">
              <header className="flex items-center gap-3 px-1">
                <h2 className="text-sm font-semibold text-[var(--zt-muted-strong)]">{selectedDateLabel}</h2>
                <span className="rounded-full bg-[var(--zt-surface-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--zt-muted)]">
                  {filteredTopics.length}
                </span>
              </header>

              <div className="space-y-3">
                {filteredTopics.map((topic) => (
                  <TopicCard key={topic.id} topic={topic} />
                ))}
              </div>
            </section>
          )
        ) : activePhase === "facts" ? (
          filteredFacts.length === 0 ? (
            <PhaseEmptyState
              title={`${selectedDateLabel}に表示できる Fact はまだありません。`}
              body="この日の Topic に対して Annotation がまだ終わっていないか、重要度判定で抽出対象がなかった状態です。"
            />
          ) : (
            <section className="space-y-3">
              <header className="flex items-center gap-3 px-1">
                <h2 className="text-sm font-semibold text-[var(--zt-muted-strong)]">{selectedDateLabel}</h2>
                <span className="rounded-full bg-[var(--zt-surface-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--zt-muted)]">
                  {filteredFacts.length}
                </span>
              </header>

              <div className="space-y-3">
                {filteredFacts.map((fact) => (
                  <FactCard key={fact.id} fact={fact} />
                ))}
              </div>
            </section>
          )
        ) : !wikiAvailable ? (
          <PhaseEmptyState
            title="Wiki テーブルがまだ利用できません。"
            body="`zerotouch_wiki_pages` が未作成です。Fact までは表示できています。"
          />
        ) : filteredWikiPages.length === 0 ? (
          <PhaseEmptyState
            title={`${selectedDateLabel}に対応する wiki page はまだありません。`}
            body="この日の Fact を取り込んだ wiki page がまだないため、最終知識面には何も出ていません。"
          />
        ) : (
          <section className="space-y-3">
            <header className="flex items-center gap-3 px-1">
              <h2 className="text-sm font-semibold text-[var(--zt-muted-strong)]">{selectedDateLabel}</h2>
              <span className="rounded-full bg-[var(--zt-surface-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--zt-muted)]">
                {filteredWikiPages.length}
              </span>
            </header>

            <div className="space-y-3">
              {filteredWikiPages.map((page) => (
                <WikiCard key={page.id} page={page} selectedFactIds={selectedFactIds} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function TopicCard({ topic }: { topic: Topic }) {
  const title =
    topic.final_title?.trim() ||
    topic.live_title?.trim() ||
    "無題のトピック";
  const summary = topic.final_summary?.trim() || topic.live_summary?.trim() || "";
  const utteranceCount = topic.utterance_count ?? topic.utterances.length;
  const status = resolveTopicStatus(topic.topic_status);

  return (
    <article className="overflow-hidden rounded-[28px] border border-[var(--zt-outline)] bg-[var(--zt-surface)] shadow-sm">
      <div className="border-b border-[var(--zt-outline)] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2">
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold", status.className)}>
                {status.label}
              </span>
              <span className="text-xs font-medium text-[var(--zt-muted)]">
                {utteranceCount} cards
              </span>
            </div>
            <h3 className="max-w-3xl text-balance text-xl font-semibold leading-tight text-[var(--zt-foreground)]">
              {title}
            </h3>
            {summary ? (
              <p className="max-w-3xl text-pretty text-sm leading-6 text-[var(--zt-muted)]">
                {summary}
              </p>
            ) : null}
          </div>

          <div className="space-y-1 text-sm text-[var(--zt-muted)] sm:text-right">
            <p>{formatDetailTime(resolveTopicReferenceTime(topic))}</p>
            <p className="text-xs">
              {topic.llm_provider ?? "LLM pending"}
              {topic.llm_model ? ` / ${topic.llm_model}` : ""}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-[var(--zt-outline)]">
        {topic.utterances.map((utterance) => (
          <div
            key={utterance.id}
            className="grid gap-3 px-5 py-4 sm:grid-cols-[120px_minmax(0,1fr)] sm:px-6"
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[var(--zt-foreground)]">
                {formatCardTime(utterance.recorded_at ?? utterance.created_at)}
              </p>
              <p className="text-xs text-[var(--zt-muted)]">
                {resolveUtteranceStatus(utterance.status)}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-pretty text-sm leading-6 text-[var(--zt-foreground)]">
                {resolveTranscriptionText(utterance)}
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--zt-muted)]">
                {utterance.transcription_metadata?.provider ? (
                  <span className="rounded-full bg-[var(--zt-surface-strong)] px-2.5 py-1">
                    {utterance.transcription_metadata.provider}
                  </span>
                ) : null}
                {utterance.transcription_metadata?.language ? (
                  <span className="rounded-full bg-[var(--zt-surface-strong)] px-2.5 py-1">
                    {utterance.transcription_metadata.language}
                  </span>
                ) : null}
                {utterance.duration_seconds ? (
                  <span className="rounded-full bg-[var(--zt-surface-strong)] px-2.5 py-1">
                    {utterance.duration_seconds}s
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function FactCard({ fact }: { fact: FactRecord }) {
  return (
    <article className="rounded-[28px] border border-[var(--zt-outline)] bg-[var(--zt-surface)] px-5 py-5 shadow-sm sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--zt-muted)]">
            <FactLevelBadge importanceLevel={fact.importance_level} />
            {fact.ttl_type ? (
              <span className="rounded-full bg-[var(--zt-surface-strong)] px-2.5 py-1 uppercase">
                {fact.ttl_type}
              </span>
            ) : null}
            {(fact.categories ?? []).slice(0, 3).map((category) => (
              <span
                key={`${fact.id}-${category}`}
                className="rounded-full bg-[var(--zt-surface-strong)] px-2.5 py-1"
              >
                {category}
              </span>
            ))}
          </div>
          <p className="max-w-4xl text-pretty text-base leading-7 text-[var(--zt-foreground)]">
            {fact.fact_text}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--zt-muted)]">
            {fact.topic_title ? (
              <span className="rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-2.5 py-1">
                from {fact.topic_title}
              </span>
            ) : null}
            {(fact.intents ?? []).slice(0, 3).map((intent) => (
              <span
                key={`${fact.id}-${intent}`}
                className="rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-2.5 py-1"
              >
                {intent}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-1 text-sm text-[var(--zt-muted)] sm:text-right">
          <p>{formatDetailTime(fact.created_at)}</p>
          <p className="text-xs">{fact.id.slice(0, 8)}</p>
        </div>
      </div>
    </article>
  );
}

function WikiCard({
  page,
  selectedFactIds,
}: {
  page: WikiPageRecord;
  selectedFactIds: Set<string>;
}) {
  const relatedFactCount = countRelatedFacts(page, selectedFactIds);

  return (
    <article className="rounded-[28px] border border-[var(--zt-outline)] bg-[var(--zt-surface)] px-5 py-5 shadow-sm sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--zt-muted)]">
            <span className="rounded-full bg-[var(--zt-primary-pale)] px-2.5 py-1 font-semibold text-[var(--zt-primary)]">
              wiki
            </span>
            <span className="rounded-full bg-[var(--zt-surface-strong)] px-2.5 py-1">
              {resolveWikiProjectLabel(page)}
            </span>
            <span className="rounded-full bg-[var(--zt-surface-strong)] px-2.5 py-1">
              {resolveWikiCategoryLabel(page)}
            </span>
            <span className="rounded-full bg-[var(--zt-surface-strong)] px-2.5 py-1">
              {page.kind?.trim() || "kind未設定"}
            </span>
            <span className="rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-2.5 py-1">
              page_key {resolveWikiPageKeyLabel(page)}
            </span>
            <span className="rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-2.5 py-1">
              related facts {relatedFactCount}
            </span>
          </div>
          <h3 className="text-balance text-xl font-semibold text-[var(--zt-foreground)]">
            {page.title}
          </h3>
          <p className="text-pretty text-sm leading-6 text-[var(--zt-foreground)]">
            {page.body}
          </p>
        </div>

        <div className="space-y-1 text-sm text-[var(--zt-muted)] sm:text-right">
          <p>{formatDetailTime(page.updated_at)}</p>
          <p className="text-xs">page v{page.version ?? 1}</p>
        </div>
      </div>
    </article>
  );
}

function PhaseEmptyState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section className="rounded-[28px] border border-dashed border-[var(--zt-outline-strong)] bg-[var(--zt-surface)] px-6 py-14 text-center">
      <p className="text-pretty text-base font-medium text-[var(--zt-foreground)]">{title}</p>
      <p className="mt-2 text-sm text-[var(--zt-muted)]">{body}</p>
    </section>
  );
}

function FactLevelBadge({ importanceLevel }: { importanceLevel: number | null }) {
  const tone =
    importanceLevel !== null && importanceLevel >= 4
      ? "bg-amber-50 text-amber-700"
      : importanceLevel === 3
        ? "bg-sky-50 text-sky-700"
        : "bg-[var(--zt-surface-strong)] text-[var(--zt-muted-strong)]";

  return (
    <span className={cn("rounded-full px-2.5 py-1 font-semibold", tone)}>
      Lv.{importanceLevel ?? 0}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Sparkles;
  label: string;
  value: number;
  tone: "primary" | "neutral";
}) {
  return (
    <div
      className={cn(
        "rounded-[22px] border px-4 py-4",
        tone === "primary"
          ? "border-[var(--zt-primary-soft)] bg-[var(--zt-primary-pale)]"
          : "border-[var(--zt-outline)] bg-[var(--zt-surface-strong)]",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="rounded-2xl bg-white/80 p-2.5 shadow-sm">
          <Icon className="size-4 text-[var(--zt-foreground)]" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--zt-muted)]">
            {label}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--zt-foreground)]">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <section className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          className="overflow-hidden rounded-[28px] border border-[var(--zt-outline)] bg-[var(--zt-surface)] shadow-sm"
        >
          <div className="space-y-3 px-6 py-5">
            <div className="h-6 w-28 rounded-full bg-[var(--zt-surface-strong)]" />
            <div className="h-8 w-2/3 rounded-full bg-[var(--zt-surface-strong)]" />
            <div className="h-4 w-full rounded-full bg-[var(--zt-surface-strong)]" />
            <div className="h-4 w-3/4 rounded-full bg-[var(--zt-surface-strong)]" />
          </div>
          <div className="border-t border-[var(--zt-outline)] px-6 py-4">
            <div className="h-4 w-full rounded-full bg-[var(--zt-surface-strong)]" />
          </div>
        </div>
      ))}
    </section>
  );
}

function resolveTopicStatus(status: TopicStatus) {
  switch (status) {
    case "active":
      return {
        label: "ライブ",
        className: "bg-emerald-50 text-emerald-700",
      };
    case "cooling":
      return {
        label: "整理中",
        className: "bg-amber-50 text-amber-700",
      };
    case "finalized":
      return {
        label: "完了",
        className: "bg-sky-50 text-sky-700",
      };
    case "failed":
      return {
        label: "失敗",
        className: "bg-rose-50 text-rose-700",
      };
    default:
      return {
        label: status,
        className: "bg-zinc-100 text-zinc-600",
      };
  }
}

function resolveUtteranceStatus(status: string) {
  switch (status) {
    case "uploaded":
      return "キュー待ち";
    case "transcribing":
      return "文字起こし中";
    case "transcribed":
      return "文字起こし済み";
    case "completed":
      return "完了";
    case "failed":
      return "失敗";
    default:
      return status;
  }
}

function resolveTranscriptionText(utterance: TopicUtterance) {
  const text = utterance.transcription?.trim();

  if (text) {
    return text;
  }

  if (utterance.status === "failed") {
    return "処理に失敗しました。";
  }

  if (utterance.status === "transcribed" || utterance.status === "completed") {
    return "音声が検出されませんでした。";
  }

  return "データ取得中...";
}

function resolveSearchPlaceholder(activePhase: PhaseKey) {
  switch (activePhase) {
    case "raw":
      return "文字起こしを検索...";
    case "facts":
      return "Fact を検索...";
    case "wiki":
      return "Wiki page を検索...";
    default:
      return "検索...";
  }
}

function buildRawHaystack(topic: Topic) {
  return [
    topic.final_title,
    topic.live_title,
    topic.final_summary,
    topic.live_summary,
    ...topic.utterances.map((utterance) => utterance.transcription ?? ""),
  ]
    .join(" ")
    .toLowerCase();
}

function buildFactHaystack(fact: FactRecord) {
  return [
    fact.fact_text,
    fact.topic_title,
    ...(fact.categories ?? []),
    ...(fact.intents ?? []),
    fact.ttl_type,
  ]
    .join(" ")
    .toLowerCase();
}

function buildWikiHaystack(page: WikiPageRecord) {
  return [
    page.title,
    page.body,
    page.project_name,
    page.project_key,
    page.category,
    page.page_key,
    page.kind,
    page.status,
  ]
    .join(" ")
    .toLowerCase();
}

function resolveWikiProjectLabel(page: Pick<WikiPageRecord, "project_name" | "project_key">) {
  return page.project_name?.trim() || page.project_key?.trim() || "未分類プロジェクト";
}

function resolveWikiCategoryLabel(page: Pick<WikiPageRecord, "category">) {
  return page.category?.trim() || "未分類カテゴリ";
}

function resolveWikiPageKeyLabel(page: Pick<WikiPageRecord, "page_key">) {
  return page.page_key?.trim() || "page_key未設定";
}

function resolveTopicReferenceTime(topic: Topic) {
  return topic.last_utterance_at ?? topic.updated_at ?? topic.end_at ?? topic.start_at ?? null;
}

function resolveTopicSortTime(topic: Topic) {
  return resolveIsoSortTime(resolveTopicReferenceTime(topic));
}

function resolveTopicDateKey(topic: Topic) {
  return toDateKey(resolveTopicReferenceTime(topic));
}

function resolveWikiSortTime(page: WikiPageRecord) {
  return resolveIsoSortTime(page.last_ingest_at ?? page.updated_at ?? page.created_at);
}

function resolveIsoSortTime(value?: string | null) {
  if (!value) {
    return 0;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function countRelatedFacts(page: WikiPageRecord, selectedFactIds: Set<string>) {
  return (page.source_fact_ids ?? []).filter((factId) => selectedFactIds.has(factId)).length;
}

function toDateKey(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return formatDateKey(date);
}

function getTodayDateKey() {
  return formatDateKey(new Date());
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number(value));
  return new Date(year, (month || 1) - 1, day || 1);
}

function addDays(dateKey: string, delta: number) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() + delta);
  return formatDateKey(date);
}

function firstDayOfMonthKey(dateKey: string) {
  const date = parseDateKey(dateKey);
  return formatDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

function addMonths(monthKey: string, delta: number) {
  const date = parseDateKey(monthKey);
  return formatDateKey(new Date(date.getFullYear(), date.getMonth() + delta, 1));
}

function formatSelectedDateLabel(dateKey: string, todayKey: string) {
  return dateKey === todayKey ? "本日" : formatLongDateLabel(dateKey);
}

function formatLongDateLabel(dateKey: string) {
  const date = parseDateKey(dateKey);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function formatShortDateLabel(dateKey: string) {
  const date = parseDateKey(dateKey);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
  }).format(date);
}

function formatMonthLabel(monthKey: string) {
  const date = parseDateKey(monthKey);
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
  }).format(date);
}

function buildCalendarDays(
  monthKey: string,
  availableDateSet: Set<string>,
  selectedDate: string,
  todayKey: string,
) {
  const monthDate = parseDateKey(monthKey);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{
    key: string;
    dateKey?: string;
    day?: number;
    hasData?: boolean;
    isSelected?: boolean;
    isFuture?: boolean;
  }> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ key: `blank-${index}` });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = formatDateKey(new Date(year, month, day));
    cells.push({
      key: dateKey,
      dateKey,
      day,
      hasData: availableDateSet.has(dateKey),
      isSelected: dateKey === selectedDate,
      isFuture: dateKey > todayKey,
    });
  }

  return cells;
}

function formatCardTime(value?: string | null) {
  if (!value) {
    return "--:--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDetailTime(value?: string | null) {
  if (!value) {
    return "時刻未取得";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "時刻未取得";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatSyncTime(value: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}
