"use client";

import { useDeferredValue, useMemo, useState } from "react";
import useSWR from "swr";
import {
  Activity,
  Clock3,
  LoaderCircle,
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

type FilterKey = "all" | "today" | "live" | "finalized";

const FILTERS: Array<{ key: FilterKey; label: string }> = [
  { key: "all", label: "すべて" },
  { key: "today", label: "今日" },
  { key: "live", label: "ライブ" },
  { key: "finalized", label: "完了" },
];
const EMPTY_TOPICS: Topic[] = [];

const fetcher = async (url: string): Promise<TopicsResponse> => {
  const response = await fetch(url, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch topics: ${response.status}`);
  }

  return response.json();
};

export function ZerotouchDashboard() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLowerCase());

  const { data, error, isLoading } = useSWR<TopicsResponse>(
    "/api/topics?limit=40&include_children=true",
    fetcher,
    {
      refreshInterval: 2500,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );

  const topics = data?.topics ?? EMPTY_TOPICS;

  const filteredTopics = useMemo(() => {
    return topics.filter((topic) => {
      const dateLabel = formatDisplayDate(
        topic.last_utterance_at ?? topic.updated_at ?? topic.end_at ?? topic.start_at,
      );
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "today" && dateLabel === "今日") ||
        (activeFilter === "live" &&
          (topic.topic_status === "active" || topic.topic_status === "cooling")) ||
        (activeFilter === "finalized" && topic.topic_status === "finalized");

      if (!matchesFilter) {
        return false;
      }

      if (!deferredQuery) {
        return true;
      }

      const haystack = [
        topic.final_title,
        topic.live_title,
        topic.final_summary,
        topic.live_summary,
        ...topic.utterances.map((utterance) => utterance.transcription ?? ""),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(deferredQuery);
    });
  }, [activeFilter, deferredQuery, topics]);

  const groupedTopics = useMemo(() => {
    return filteredTopics.reduce<Record<string, Topic[]>>((acc, topic) => {
      const label = formatDisplayDate(
        topic.last_utterance_at ?? topic.updated_at ?? topic.end_at ?? topic.start_at,
      );
      acc[label] ??= [];
      acc[label].push(topic);
      return acc;
    }, {});
  }, [filteredTopics]);

  const totalUtterances = topics.reduce(
    (count, topic) => count + (topic.utterance_count ?? topic.utterances.length),
    0,
  );
  const liveTopicCount = topics.filter((topic) =>
    topic.topic_status === "active" || topic.topic_status === "cooling",
  ).length;
  const lastSyncAt = data ? new Date() : null;

  return (
    <main className="min-h-dvh bg-[var(--zt-background)] px-4 py-4 text-[var(--zt-foreground)] sm:px-6">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <section className="rounded-[28px] border border-[var(--zt-outline)] bg-[var(--zt-surface)] px-5 py-5 shadow-sm sm:px-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-[var(--zt-surface-strong)] px-3 py-1 text-xs font-semibold text-[var(--zt-muted-strong)]">
                  <Radio className="size-3.5 text-[var(--zt-primary)]" />
                  ZeroTouch Web Feed
                </div>
                <div className="space-y-1">
                  <h1 className="max-w-2xl text-balance text-[2rem] font-semibold leading-tight sm:text-[2.5rem]">
                    会話が Web に同期される様子を、そのまま見せる。
                  </h1>
                  <p className="max-w-2xl text-pretty text-sm leading-6 text-[var(--zt-muted)] sm:text-[15px]">
                    Android で収集されたトピックとカードを、閲覧専用でほぼリアルタイム表示します。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <StatCard
                  icon={Sparkles}
                  label="トピック"
                  value={topics.length}
                  tone="primary"
                />
                <StatCard
                  icon={Activity}
                  label="ライブ"
                  value={liveTopicCount}
                  tone="warm"
                />
                <StatCard
                  icon={Clock3}
                  label="カード"
                  value={totalUtterances}
                  tone="neutral"
                  className="col-span-2 sm:col-span-1"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <label className="flex min-w-0 flex-[0.48] items-center gap-3 rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-3">
                <Search className="size-4 shrink-0 text-[var(--zt-muted)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="文字起こしを検索..."
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--zt-foreground)] outline-none placeholder:text-[var(--zt-muted)]"
                />
              </label>

              <div className="min-w-0 flex-[0.52] overflow-x-auto">
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
                    : "2.5秒ごとに同期"}
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
            バックエンドに接続できませんでした。`ZEROTOUCH_API_BASE_URL` と公開 API の到達性を確認してください。
          </section>
        ) : null}

        {isLoading && !data ? (
          <DashboardSkeleton />
        ) : filteredTopics.length === 0 ? (
          <section className="rounded-[28px] border border-dashed border-[var(--zt-outline-strong)] bg-[var(--zt-surface)] px-6 py-14 text-center">
            <p className="text-pretty text-base font-medium text-[var(--zt-foreground)]">
              表示できるトピックがまだありません。
            </p>
            <p className="mt-2 text-sm text-[var(--zt-muted)]">
              会話が取り込まれると、ここにカード付きで反映されます。
            </p>
          </section>
        ) : (
          Object.entries(groupedTopics).map(([label, items]) => (
            <section key={label} className="space-y-3">
              <header className="flex items-center gap-3 px-1">
                <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--zt-muted-strong)]">
                  {label}
                </h2>
                <span className="rounded-full bg-[var(--zt-surface-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--zt-muted)]">
                  {items.length}
                </span>
              </header>

              <div className="space-y-3">
                {items.map((topic) => (
                  <TopicCard key={topic.id} topic={topic} />
                ))}
              </div>
            </section>
          ))
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
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold",
                  status.className,
                )}
              >
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
            <p>{formatDetailTime(topic.last_utterance_at ?? topic.updated_at)}</p>
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

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  className,
}: {
  icon: typeof Sparkles;
  label: string;
  value: number;
  tone: "primary" | "warm" | "neutral";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-[22px] border px-4 py-4",
        tone === "primary" &&
          "border-[var(--zt-primary-soft)] bg-[var(--zt-primary-pale)]",
        tone === "warm" && "border-amber-200 bg-amber-50",
        tone === "neutral" &&
          "border-[var(--zt-outline)] bg-[var(--zt-surface-strong)]",
        className,
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

function formatDisplayDate(value?: string | null) {
  if (!value) {
    return "不明";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "不明";
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (target.getTime() === today.getTime()) {
    return "今日";
  }

  if (target.getTime() === yesterday.getTime()) {
    return "昨日";
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
  }).format(date);
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
