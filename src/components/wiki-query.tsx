"use client";

import Link from "next/link";
import {
  useCallback,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  BookOpenText,
  CheckCircle2,
  CircleHelp,
  FileText,
  History,
  LoaderCircle,
  Send,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";

const DEFAULT_DEVICE_ID = "amical-db-test";
const DEFAULT_MAX_PAGES = 5;

type Outcome = "derivable" | "synthesis" | "gap_or_conflict" | string;
type Confidence = "high" | "medium" | "low" | string;

type SourcePage = {
  id: string;
  title: string;
  project_name: string | null;
  category: string | null;
  page_key: string | null;
  kind: string | null;
};

type FilingBackAction = "none" | "new_page" | "flag" | string;

type FilingBack = {
  action: FilingBackAction;
  new_page_id: string | null;
  target_page_id: string | null;
};

type QueryWikiSuccessResponse = {
  success: true;
  query_id: string;
  device_id: string;
  question: string;
  answer: string;
  confidence: Confidence;
  outcome: Outcome;
  reasoning: string;
  source_pages: SourcePage[];
  selected_page_ids: string[];
  filing_back: FilingBack;
  created_at: string;
};

type QueryWikiFailureResponse = {
  success: false;
  reason: string;
};

type QueryWikiResponse = QueryWikiSuccessResponse | QueryWikiFailureResponse;

type WikiLogEntry = {
  id: string;
  operation: string;
  question: string | null;
  answer: string | null;
  confidence: Confidence | null;
  outcome: Outcome | null;
  reasoning: string | null;
  source_page_ids: string[] | null;
  target_page_id: string | null;
  result_page_id: string | null;
  llm_provider: string | null;
  llm_model: string | null;
  created_at: string;
};

type WikiLogResponse = {
  device_id: string;
  entries: WikiLogEntry[];
};

type ProviderOption = {
  value: string;
  label: string;
  defaultModel: string;
};

const PROVIDER_OPTIONS: ProviderOption[] = [
  { value: "openai", label: "OpenAI", defaultModel: "gpt-5.4-2026-03-05" },
  { value: "anthropic", label: "Anthropic", defaultModel: "claude-sonnet-4" },
  { value: "google", label: "Google", defaultModel: "gemini-2.0-flash" },
];

type AnswerView =
  | { kind: "fresh"; data: QueryWikiSuccessResponse }
  | { kind: "log"; entry: WikiLogEntry };

const EMPTY_ENTRIES: WikiLogEntry[] = [];

async function jsonFetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function WikiQuery() {
  const [question, setQuestion] = useState("");
  const [provider, setProvider] = useState<string>(PROVIDER_OPTIONS[0].value);
  const [model, setModel] = useState<string>(PROVIDER_OPTIONS[0].defaultModel);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAnswer, setCurrentAnswer] = useState<AnswerView | null>(null);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

  const logUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("device_id", DEFAULT_DEVICE_ID);
    params.set("operation", "query");
    params.set("limit", "50");
    return `/api/wiki-log?${params.toString()}`;
  }, []);

  const {
    data: logData,
    error: logError,
    isLoading: isLogLoading,
  } = useSWR<WikiLogResponse>(logUrl, jsonFetcher, {
    refreshInterval: 10000,
    revalidateOnFocus: true,
    keepPreviousData: true,
  });

  const entries = logData?.entries ?? EMPTY_ENTRIES;

  const handleProviderChange = useCallback((next: string) => {
    setProvider(next);
    const matched = PROVIDER_OPTIONS.find((option) => option.value === next);
    if (matched) {
      setModel(matched.defaultModel);
    }
  }, []);

  const submitQuery = useCallback(async () => {
    const trimmed = question.trim();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/query-wiki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: DEFAULT_DEVICE_ID,
          question: trimmed,
          provider,
          model,
          max_pages: DEFAULT_MAX_PAGES,
        }),
      });

      const payload = (await response.json()) as QueryWikiResponse;

      if (!response.ok || !payload.success) {
        const reason =
          !payload.success && payload.reason
            ? payload.reason
            : `サーバーエラー (${response.status})`;
        setError(reason);
        return;
      }

      setCurrentAnswer({ kind: "fresh", data: payload });
      setSelectedLogId(null);
      setQuestion("");
    } catch (fetchError) {
      const message =
        fetchError instanceof Error ? fetchError.message : "リクエストに失敗しました";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, model, provider, question]);

  const handleTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        void submitQuery();
      }
    },
    [submitQuery],
  );

  const handleSelectLogEntry = useCallback((entry: WikiLogEntry) => {
    setCurrentAnswer({ kind: "log", entry });
    setSelectedLogId(entry.id);
  }, []);

  return (
    <main className="min-h-dvh bg-[var(--zt-background)] text-[var(--zt-foreground)] flex flex-col">
      {/* ── Compact header ───────────────────────────────────── */}
      <header className="shrink-0 border-b border-[var(--zt-outline)] bg-[var(--zt-surface)]/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] items-center gap-3 px-4 py-2 sm:px-6">
          <h1 className="mr-auto text-sm font-semibold text-[var(--zt-foreground)]">
            Query
          </h1>
          <select
            value={provider}
            onChange={(event) => handleProviderChange(event.target.value)}
            className="rounded border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-2 py-1 text-xs text-[var(--zt-muted-strong)] outline-none"
          >
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <input
            value={model}
            onChange={(event) => setModel(event.target.value)}
            className="w-36 rounded border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-2 py-1 text-xs text-[var(--zt-muted-strong)] outline-none"
            placeholder="gpt-4.1-mini"
          />
          <span
            className="inline-flex items-center"
            title={logError ? "同期エラー" : isLogLoading ? "同期中" : "10秒ごとに同期"}
          >
            <LoaderCircle
              className={cn(
                "size-3.5 shrink-0",
                isLogLoading ? "animate-spin text-[var(--zt-primary)]" : "text-[var(--zt-muted)]",
              )}
            />
          </span>
        </div>
      </header>

      {/* ── Question form (full width) ────────────────────────── */}
      <div className="shrink-0 border-b border-[var(--zt-outline)] bg-[var(--zt-surface)] px-4 py-3 sm:px-6">
        <div className="mx-auto w-full max-w-[1400px]">
          <div className="flex items-start gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-2.5 focus-within:border-[var(--zt-primary-soft)]">
              <Sparkles className="mt-0.5 size-3.5 shrink-0 text-[var(--zt-primary)]" />
              <textarea
                id="query-input"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={handleTextareaKeyDown}
                rows={2}
                disabled={isSubmitting}
                placeholder="Wikiに質問する（Cmd/Ctrl + Enter で送信）"
                className="w-full resize-none bg-transparent text-sm leading-6 text-[var(--zt-foreground)] outline-none placeholder:text-[var(--zt-muted)] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <button
              type="button"
              onClick={() => void submitQuery()}
              disabled={isSubmitting || question.trim().length === 0}
              className={cn(
                "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors",
                isSubmitting || question.trim().length === 0
                  ? "cursor-not-allowed border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] text-[var(--zt-muted)]"
                  : "border-[var(--zt-primary-soft)] bg-[var(--zt-primary-pale)] text-[var(--zt-primary)] hover:bg-[var(--zt-primary-soft)]",
              )}
            >
              {isSubmitting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
              {isSubmitting ? "問い合わせ中" : "送信"}
            </button>
          </div>
          {error ? (
            <div className="mt-2 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── 2-column: History | Content ───────────────────────── */}
      <div className="mx-auto grid min-h-0 w-full max-w-[1400px] flex-1 grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Left: History */}
        <aside className="border-b border-[var(--zt-outline)] bg-[var(--zt-surface)] lg:h-full lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--zt-muted)]">
              <History className="size-3.5" />
              History
              <span className="ml-auto tabular-nums text-[10px] normal-case tracking-normal text-[var(--zt-muted)]">
                {entries.length}
              </span>
            </div>

            {entries.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--zt-outline-strong)] px-3 py-6 text-center text-xs text-[var(--zt-muted)]">
                {isLogLoading ? "読み込み中" : "まだ質問履歴がありません。"}
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {entries.map((entry) => {
                  const isActive = entry.id === selectedLogId;
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectLogEntry(entry)}
                        className={cn(
                          "flex w-full flex-col gap-1.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                          isActive
                            ? "border-[var(--zt-primary-soft)] bg-[var(--zt-primary-pale)]"
                            : "border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] hover:bg-[var(--zt-surface-strong)]",
                        )}
                      >
                        <span
                          className={cn(
                            "line-clamp-2 text-sm leading-snug",
                            isActive
                              ? "text-[var(--zt-primary)]"
                              : "text-[var(--zt-foreground)]",
                          )}
                        >
                          {truncate(entry.question ?? "(質問なし)", 60)}
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-[var(--zt-muted)]">
                          {entry.outcome ? (
                            <OutcomeBadge outcome={entry.outcome} size="xs" />
                          ) : null}
                          <span className="tabular-nums">
                            {formatDateTime(entry.created_at)}
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Right: Content */}
        <section className="overflow-y-auto px-4 py-6 sm:px-8 lg:px-10">
          <div className="mx-auto w-full max-w-3xl space-y-6">
            {currentAnswer ? (
              <AnswerCard view={currentAnswer} />
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--zt-outline-strong)] bg-[var(--zt-surface)] px-8 py-16 text-center">
                <p className="text-base font-medium text-[var(--zt-foreground)]">
                  質問するか、左の履歴からエントリを選んでください。
                </p>
                <p className="mt-2 text-sm text-[var(--zt-muted)]">
                  回答、参照されたページ、filing-back の結果がここに表示されます。
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function AnswerCard({ view }: { view: AnswerView }) {
  const question =
    view.kind === "fresh" ? view.data.question : view.entry.question ?? "";
  const answer =
    view.kind === "fresh" ? view.data.answer : view.entry.answer ?? "";
  const outcome =
    view.kind === "fresh" ? view.data.outcome : view.entry.outcome ?? null;
  const confidence =
    view.kind === "fresh" ? view.data.confidence : view.entry.confidence ?? null;
  const reasoning =
    view.kind === "fresh" ? view.data.reasoning : view.entry.reasoning ?? null;
  const createdAt =
    view.kind === "fresh" ? view.data.created_at : view.entry.created_at;
  const provider = view.kind === "log" ? view.entry.llm_provider : null;
  const modelLabel = view.kind === "log" ? view.entry.llm_model : null;

  const sourcePages: SourcePage[] = view.kind === "fresh" ? view.data.source_pages : [];
  const sourcePageIds =
    view.kind === "log" ? view.entry.source_page_ids ?? [] : [];
  const filingBack: FilingBack | null =
    view.kind === "fresh"
      ? view.data.filing_back
      : buildFilingBackFromEntry(view.entry);

  return (
    <article className="rounded-[28px] border border-[var(--zt-outline)] bg-[var(--zt-surface)] p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {outcome ? <OutcomeBadge outcome={outcome} size="sm" /> : null}
        {confidence ? <ConfidenceBadge confidence={confidence} /> : null}
        <span className="ml-auto text-xs text-[var(--zt-muted)]">
          {formatDateTime(createdAt)}
        </span>
      </div>

      <h2 className="mt-4 text-balance text-xl font-semibold leading-snug text-[var(--zt-foreground)] sm:text-2xl">
        {question || "(質問なし)"}
      </h2>

      <div className="mt-4 space-y-3 text-[15px] leading-7 text-[var(--zt-foreground)]">
        {answer ? (
          renderAnswerBody(answer)
        ) : (
          <p className="text-sm text-[var(--zt-muted)]">回答がありません。</p>
        )}
      </div>

      {reasoning ? (
        <p className="mt-4 rounded-xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-3 py-2 text-xs text-[var(--zt-muted-strong)]">
          <span className="font-semibold text-[var(--zt-muted-strong)]">Reasoning: </span>
          {reasoning}
        </p>
      ) : null}

      {view.kind === "fresh" && sourcePages.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--zt-muted)]">
            参照したページ
          </h3>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {sourcePages.map((page) => (
              <li key={page.id}>
                <Link
                  href="/wiki"
                  className="flex w-full items-start gap-2 rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface)] px-3 py-3 text-left hover:bg-[var(--zt-surface-strong)]"
                >
                  <FileText className="mt-0.5 size-3.5 shrink-0 text-[var(--zt-muted)]" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-[var(--zt-foreground)]">
                      {page.title}
                    </span>
                    <span className="mt-1 block truncate text-xs text-[var(--zt-muted)]">
                      {[page.project_name, page.category]
                        .filter((value) => value && value.trim())
                        .join(" / ") || "未分類"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {view.kind === "log" && sourcePageIds.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--zt-muted)]">
            参照したページ
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {sourcePageIds.map((id) => (
              <li key={id}>
                <Link
                  href="/wiki"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface)] px-3 py-1 text-xs text-[var(--zt-muted-strong)] hover:bg-[var(--zt-surface-strong)]"
                >
                  <FileText className="size-3" />
                  <span className="tabular-nums">{id.slice(0, 8)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {filingBack ? <FilingBackSection filingBack={filingBack} /> : null}

      {provider || modelLabel ? (
        <p className="mt-4 text-[11px] text-[var(--zt-muted)]">
          {[provider, modelLabel].filter(Boolean).join(" / ")}
        </p>
      ) : null}
    </article>
  );
}

function FilingBackSection({ filingBack }: { filingBack: FilingBack }) {
  if (filingBack.action === "none") {
    return (
      <section className="mt-6 flex items-start gap-2 rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-3 text-sm text-[var(--zt-muted-strong)]">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--zt-primary)]" />
        <span>
          この質問は既存ページから直接導けるため、新規ページは作成されませんでした。
        </span>
      </section>
    );
  }

  if (filingBack.action === "new_page") {
    return (
      <section className="mt-6 rounded-2xl border border-[var(--zt-primary-soft)] bg-[var(--zt-primary-pale)] px-4 py-3 text-sm text-[var(--zt-primary)]">
        <div className="flex items-start gap-2">
          <BookOpenText className="mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-1">
            <span>
              この質問の回答を新しいページ（query_answer）として保存しました。
            </span>
            <Link
              href="/wiki"
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--zt-primary-soft)] bg-[var(--zt-surface)] px-3 py-1 text-xs font-medium text-[var(--zt-primary)] hover:bg-[var(--zt-surface-strong)]"
            >
              Wiki で開く
              <BookOpenText className="size-3" />
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (filingBack.action === "flag") {
    return (
      <section className="mt-6 flex items-start gap-2 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
        <div className="flex flex-col gap-1">
          <span>
            この質問で既存ページの欠落 / 矛盾が検出されました。
          </span>
          {filingBack.target_page_id ? (
            <Link
              href="/wiki"
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-amber-300 bg-white/60 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-white"
            >
              対象ページ {filingBack.target_page_id.slice(0, 8)} を Wiki で開く
              <BookOpenText className="size-3" />
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  return null;
}

function OutcomeBadge({
  outcome,
  size = "sm",
}: {
  outcome: Outcome;
  size?: "xs" | "sm";
}) {
  const normalized = typeof outcome === "string" ? outcome.toLowerCase() : "";
  const showGuide = size !== "xs";
  const { label, className } = (() => {
    if (normalized === "derivable") {
      return {
        label: "derivable",
        className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    }
    if (normalized === "synthesis") {
      return {
        label: "synthesis",
        className: "bg-sky-50 text-sky-700 border-sky-200",
      };
    }
    if (normalized === "gap_or_conflict") {
      return {
        label: "gap / conflict",
        className: "bg-amber-50 text-amber-800 border-amber-200",
      };
    }
    return {
      label: outcome,
      className:
        "bg-[var(--zt-surface-strong)] text-[var(--zt-muted-strong)] border-[var(--zt-outline)]",
    };
  })();

  const guide = getOutcomeGuide(normalized);
  const sizeClass = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";

  if (!showGuide) {
    return (
      <span
        className={cn(
          "inline-flex items-center rounded-full border font-semibold uppercase tracking-[0.04em]",
          sizeClass,
          className,
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <span
        className={cn(
          "inline-flex items-center rounded-full border font-semibold uppercase tracking-[0.04em]",
          sizeClass,
          className,
        )}
      >
        {label}
      </span>

      <details className="group relative">
        <summary
          className="inline-flex size-5 cursor-pointer list-none items-center justify-center rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] text-[var(--zt-muted)] hover:bg-[var(--zt-surface-strong)] [&::-webkit-details-marker]:hidden"
          aria-label={`${label} の説明を表示`}
        >
          <CircleHelp className="size-3.5" />
        </summary>
        <div className="absolute left-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface)] p-3 text-xs leading-5 text-[var(--zt-muted-strong)] shadow-lg">
          <p className="font-semibold text-[var(--zt-foreground)]">{guide.title}</p>
          <p className="mt-2">
            <span className="font-semibold text-[var(--zt-foreground)]">意味: </span>
            {guide.meaning}
          </p>
          <p className="mt-2">
            <span className="font-semibold text-[var(--zt-foreground)]">解消方法: </span>
            {guide.resolution}
          </p>
          {guide.futureHint ? (
            <p className="mt-2">
              <span className="font-semibold text-[var(--zt-foreground)]">今後の会話との関係: </span>
              {guide.futureHint}
            </p>
          ) : null}
        </div>
      </details>
    </span>
  );
}

function getOutcomeGuide(normalizedOutcome: string): {
  title: string;
  meaning: string;
  resolution: string;
  futureHint: string;
} {
  if (normalizedOutcome === "derivable") {
    return {
      title: "derivable",
      meaning:
        "既存の Wiki ページだけで回答できた状態です。新規ページ作成や欠損フラグは発生しません。",
      resolution:
        "特別な解消作業は不要です。回答品質を上げたい場合は、関連ページを手動で更新してから再質問します。",
      futureHint:
        "今後の会話で新しい事実が増え、Ingest されると回答の精度や具体性がさらに上がります。",
    };
  }

  if (normalizedOutcome === "synthesis") {
    return {
      title: "synthesis",
      meaning:
        "複数ページを統合して新しい知見が必要と判定された状態です。query_answer ページを新規作成します。",
      resolution:
        "作成された query_answer を確認し、必要なら canonical ページへ反映して再 Ingest します。",
      futureHint:
        "今後の会話で関連事実が増えると、同テーマの synthesis がより安定して再利用されます。",
    };
  }

  if (normalizedOutcome === "gap_or_conflict") {
    return {
      title: "gap / conflict",
      meaning:
        "既存 Wiki に情報不足または矛盾があり、回答を確定できなかった状態です。ログには残りますが自動修復はしません。",
      resolution:
        "追加情報を会話や入力で集め、Fact 化された後に Ingest を再実行して同じ質問を再テストします。",
      futureHint:
        "今後の会話の中で答えに必要な情報が出てきて取り込まれれば、このステータスは解消され得ます。",
    };
  }

  return {
    title: normalizedOutcome || "unknown",
    meaning: "このステータスの定義は未登録です。",
    resolution: "ログ内容を確認し、必要なら Ingest と再質問で挙動を確認してください。",
    futureHint: "新しい会話データが取り込まれると結果が変わる場合があります。",
  };
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const normalized =
    typeof confidence === "string" ? confidence.toLowerCase() : "";
  const className = (() => {
    if (normalized === "high") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (normalized === "medium") return "bg-sky-50 text-sky-700 border-sky-200";
    if (normalized === "low") return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-[var(--zt-surface-strong)] text-[var(--zt-muted-strong)] border-[var(--zt-outline)]";
  })();

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.04em]",
        className,
      )}
    >
      confidence: {confidence}
    </span>
  );
}

function renderAnswerBody(body: string): ReactNode[] {
  if (!body?.trim()) return [];
  const paragraphs = body.split(/\n{2,}/);

  return paragraphs.map((paragraph, paragraphIndex) => {
    const lines = paragraph.split(/\n/);
    const isBulletBlock =
      lines.length > 0 && lines.every((line) => /^\s*[-・*]\s+/.test(line));

    if (isBulletBlock) {
      return (
        <ul
          key={`p${paragraphIndex}`}
          className="ml-5 list-disc space-y-1.5"
        >
          {lines.map((line, lineIndex) => {
            const text = line.replace(/^\s*[-・*]\s+/, "");
            return (
              <li key={`p${paragraphIndex}-l${lineIndex}`}>
                {renderInline(text, `p${paragraphIndex}-l${lineIndex}`)}
              </li>
            );
          })}
        </ul>
      );
    }

    return (
      <p key={`p${paragraphIndex}`}>
        {lines.map((line, lineIndex) => (
          <span key={`p${paragraphIndex}-l${lineIndex}`}>
            {renderInline(line, `p${paragraphIndex}-l${lineIndex}`)}
            {lineIndex < lines.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>
    );
  });
}

function renderInline(text: string, keyPrefix: string): ReactNode {
  if (!text) return text;

  const pattern = /\[\[([^\]]+)\]\]/g;
  const segments: Array<string | { pageKey: string }> = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      segments.push(text.slice(cursor, match.index));
    }
    segments.push({ pageKey: match[1].trim() });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    segments.push(text.slice(cursor));
  }

  if (segments.length === 0) segments.push(text);

  return segments.map((segment, segmentIndex) => {
    const key = `${keyPrefix}-s${segmentIndex}`;
    if (typeof segment === "string") {
      return <span key={key}>{segment}</span>;
    }
    return (
      <Link
        key={key}
        href="/wiki"
        className="rounded px-0.5 font-medium text-[var(--zt-primary)] underline decoration-[var(--zt-primary-soft)] decoration-2 underline-offset-2 hover:decoration-[var(--zt-primary)]"
      >
        {segment.pageKey}
      </Link>
    );
  });
}

function buildFilingBackFromEntry(entry: WikiLogEntry): FilingBack | null {
  if (entry.result_page_id) {
    return {
      action: "new_page",
      new_page_id: entry.result_page_id,
      target_page_id: entry.target_page_id,
    };
  }
  if (entry.target_page_id) {
    return {
      action: "flag",
      new_page_id: null,
      target_page_id: entry.target_page_id,
    };
  }
  return {
    action: "none",
    new_page_id: null,
    target_page_id: null,
  };
}

function truncate(value: string, length: number): string {
  if (!value) return "";
  if (value.length <= length) return value;
  return `${value.slice(0, length)}…`;
}

function formatDateTime(value: string | null): string {
  if (!value) return "";
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch {
    return value;
  }
}
