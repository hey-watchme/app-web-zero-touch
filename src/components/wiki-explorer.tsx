"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";
import {
  ArrowLeft,
  BookOpenText,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  Hash,
  LoaderCircle,
  Search,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/cn";

type WikiPage = {
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

type FactRecord = {
  id: string;
  topic_id: string;
  fact_text: string;
  importance_level: number | null;
  categories: string[] | null;
  ttl_type: string | null;
  created_at: string;
};

type WikiResponse = {
  deviceId: string;
  pages: WikiPage[];
  wikiAvailable: boolean;
};

type WikiFactsResponse = {
  facts: FactRecord[];
};

type KindKey = "all" | "decision" | "rule" | "insight" | "procedure" | "task" | "other";

const KIND_FILTERS: Array<{ key: KindKey; label: string }> = [
  { key: "all", label: "すべて" },
  { key: "decision", label: "decision" },
  { key: "rule", label: "rule" },
  { key: "insight", label: "insight" },
  { key: "procedure", label: "procedure" },
  { key: "task", label: "task" },
  { key: "other", label: "other" },
];

const NO_PROJECT_KEY = "__no_project__";
const NO_CATEGORY_KEY = "__no_category__";
const EMPTY_PAGES: WikiPage[] = [];
const EMPTY_FACT_IDS: string[] = [];

async function jsonFetcher<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function WikiExplorer() {
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<KindKey>("all");
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(new Set());
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());

  const forceSplitLayout = searchParams.get("layout") === "split";

  const { data, error, isLoading } = useSWR<WikiResponse>(
    "/api/wiki",
    jsonFetcher,
    {
      refreshInterval: 15000,
      revalidateOnFocus: true,
      keepPreviousData: true,
    },
  );

  const pages = data?.pages ?? EMPTY_PAGES;
  const wikiAvailable = data?.wikiAvailable ?? true;

  const filteredPages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return pages.filter((page) => {
      if (kindFilter !== "all") {
        const pageKind = page.kind ?? "other";
        const bucket = kindFilter === "other"
          ? !["decision", "rule", "insight", "procedure", "task"].includes(page.kind ?? "")
          : pageKind === kindFilter;
        if (!bucket) return false;
      }
      if (!normalizedQuery) return true;
      const haystack = [
        page.title,
        page.body,
        page.project_name ?? "",
        page.project_key ?? "",
        page.category ?? "",
        page.page_key ?? "",
        page.kind ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [kindFilter, pages, query]);

  const grouped = useMemo(() => {
    const buckets = new Map<
      string,
      {
        key: string;
        label: string;
        isMissing: boolean;
        categories: Map<
          string,
          {
            key: string;
            label: string;
            isMissing: boolean;
            pages: WikiPage[];
          }
        >;
      }
    >();

    filteredPages.forEach((page) => {
      const projectKey = resolveProjectBucketKey(page);
      const categoryKey = resolveCategoryBucketKey(page);
      const projectLabel = resolveProjectLabel(page);
      const categoryLabel = resolveCategoryLabel(page);

      let projectBucket = buckets.get(projectKey);
      if (!projectBucket) {
        projectBucket = {
          key: projectKey,
          label: projectLabel,
          isMissing: projectKey === NO_PROJECT_KEY,
          categories: new Map(),
        };
        buckets.set(projectKey, projectBucket);
      }

      let categoryBucket = projectBucket.categories.get(categoryKey);
      if (!categoryBucket) {
        categoryBucket = {
          key: categoryKey,
          label: categoryLabel,
          isMissing: categoryKey === NO_CATEGORY_KEY,
          pages: [],
        };
        projectBucket.categories.set(categoryKey, categoryBucket);
      }

      categoryBucket.pages.push(page);
    });

    return [...buckets.values()]
      .map((project) => ({
        ...project,
        categories: [...project.categories.values()]
          .map((category) => ({
            ...category,
            pages: [...category.pages].sort((left, right) =>
              left.title.localeCompare(right.title, "ja"),
            ),
          }))
          .sort((left, right) => compareBucketLabels(left, right)),
      }))
      .sort((left, right) => compareBucketLabels(left, right));
  }, [filteredPages]);

  const activeSelectedId = useMemo(() => {
    if (selectedId && filteredPages.some((page) => page.id === selectedId)) {
      return selectedId;
    }

    return filteredPages[0]?.id ?? null;
  }, [filteredPages, selectedId]);

  const selectedPage = useMemo(
    () => pages.find((page) => page.id === activeSelectedId) ?? null,
    [activeSelectedId, pages],
  );

  const selectedFactIds = useMemo(() => {
    if (!selectedPage) return EMPTY_FACT_IDS;
    return (selectedPage.source_fact_ids ?? []).filter((id): id is string => Boolean(id));
  }, [selectedPage]);

  const selectedFactQueryUrl = (() => {
    if (!selectedPage || selectedFactIds.length === 0) return null;
    const params = new URLSearchParams();
    if (data?.deviceId) {
      params.set("device_id", data.deviceId);
    }
    selectedFactIds.forEach((id) => params.append("id", id));
    return `/api/wiki-facts?${params.toString()}`;
  })();

  const {
    data: selectedFactsData,
    error: selectedFactsError,
    isLoading: isSelectedFactsLoading,
  } = useSWR<WikiFactsResponse>(
    selectedFactQueryUrl,
    jsonFetcher,
    {
      refreshInterval: 0,
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  );

  const selectedFactMap = useMemo(() => {
    const map = new Map<string, FactRecord>();
    (selectedFactsData?.facts ?? []).forEach((fact) => map.set(fact.id, fact));
    return map;
  }, [selectedFactsData?.facts]);

  const relatedPages = useMemo(() => {
    if (!selectedPage) return [] as WikiPage[];

    const selectedProjectKey = resolveProjectBucketKey(selectedPage);

    return pages.filter(
      (page) =>
        page.id !== selectedPage.id &&
        resolveProjectBucketKey(page) === selectedProjectKey,
    );
  }, [pages, selectedPage]);

  const pageKeyToIdMap = useMemo(() => {
    const map = new Map<string, string>();
    pages.forEach((page) => {
      const pageKey = page.page_key?.trim().toLowerCase();
      if (pageKey) {
        map.set(pageKey, page.id);
      }
    });
    return map;
  }, [pages]);

  const sourceFacts = useMemo(() => {
    if (!selectedPage) return [] as FactRecord[];
    return (selectedPage.source_fact_ids ?? [])
      .map((id) => selectedFactMap.get(id))
      .filter((value): value is FactRecord => Boolean(value));
  }, [selectedFactMap, selectedPage]);

  function toggleProject(projectKey: string) {
    setCollapsedProjects((previous) => {
      const next = new Set(previous);
      if (next.has(projectKey)) next.delete(projectKey);
      else next.add(projectKey);
      return next;
    });
  }

  function toggleCategory(categoryKey: string) {
    setCollapsedCategories((previous) => {
      const next = new Set(previous);
      if (next.has(categoryKey)) next.delete(categoryKey);
      else next.add(categoryKey);
      return next;
    });
  }

  return (
    <main className="min-h-dvh bg-[var(--zt-background)] text-[var(--zt-foreground)]">
      <header className="border-b border-[var(--zt-outline)] bg-[var(--zt-surface)]/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-3 py-1.5 text-sm font-medium text-[var(--zt-muted-strong)] hover:bg-[var(--zt-surface-strong)]"
            >
              <ArrowLeft className="size-4" />
              Dashboard
            </Link>
            <div className="flex items-center gap-2">
              <BookOpenText className="size-5 text-[var(--zt-primary)]" />
              <h1 className="text-lg font-semibold text-[var(--zt-foreground)]">
                ZeroTouch Wiki
              </h1>
              <span className="rounded-full bg-[var(--zt-surface-strong)] px-2.5 py-1 text-xs font-semibold text-[var(--zt-muted)]">
                {pages.length} pages
              </span>
            </div>
          </div>

          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-3 py-1.5 sm:max-w-md">
            <Search className="size-4 shrink-0 text-[var(--zt-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="タイトル・本文・project/category/page_key で検索"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--zt-muted)]"
            />
          </label>

          <div className="inline-flex items-center gap-2 text-xs text-[var(--zt-muted)]">
            <LoaderCircle
              className={cn(
                "size-3.5",
                isLoading ? "animate-spin text-[var(--zt-primary)]" : "text-[var(--zt-muted)]",
              )}
            />
            {error ? "同期エラー" : isLoading ? "同期中" : "15秒ごとに同期"}
          </div>
        </div>
      </header>

      {!wikiAvailable ? (
        <div className="mx-auto w-full max-w-[1400px] px-6 py-10">
          <EmptyState
            title="Wiki テーブルがまだ利用できません。"
            body="`zerotouch_wiki_pages` が未作成です。バックエンドで migration 011 を適用してください。"
          />
        </div>
      ) : (
        <div
          className={cn(
            "mx-auto grid w-full max-w-[1400px] gap-0 px-0",
            forceSplitLayout
              ? "grid-cols-[280px_minmax(0,1fr)]"
              : "grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]",
          )}
        >
          <aside
            className={cn(
              "border-b border-[var(--zt-outline)] bg-[var(--zt-surface)]",
              forceSplitLayout
                ? "sticky top-0 h-[calc(100dvh-57px)] overflow-y-auto border-b-0 border-r"
                : "lg:sticky lg:top-0 lg:h-[calc(100dvh-57px)] lg:overflow-y-auto lg:border-b-0 lg:border-r",
            )}
          >
            <div className="flex flex-col gap-4 p-4">
              <div className="flex flex-wrap gap-1.5">
                {KIND_FILTERS.map((filter) => {
                  const isActive = filter.key === kindFilter;
                  return (
                    <button
                      key={filter.key}
                      type="button"
                      onClick={() => setKindFilter(filter.key)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                        isActive
                          ? "border-[var(--zt-primary-soft)] bg-[var(--zt-primary-pale)] text-[var(--zt-primary)]"
                          : "border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] text-[var(--zt-muted-strong)] hover:bg-[var(--zt-surface-strong)]",
                      )}
                    >
                      {filter.label}
                    </button>
                  );
                })}
              </div>

              {grouped.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[var(--zt-outline-strong)] px-3 py-6 text-center text-xs text-[var(--zt-muted)]">
                  該当するページがありません。
                </p>
              ) : (
                <nav className="flex flex-col gap-1">
                  {grouped.map((project) => {
                    const collapsedProject = collapsedProjects.has(project.key);
                    return (
                      <div key={project.key} className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => toggleProject(project.key)}
                          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-[var(--zt-muted-strong)] hover:bg-[var(--zt-surface-strong)]"
                        >
                          {collapsedProject ? (
                            <ChevronRight className="size-3.5" />
                          ) : (
                            <ChevronDown className="size-3.5" />
                          )}
                          <Folder className="size-3.5 text-[var(--zt-muted)]" />
                          <span className="flex-1 truncate normal-case tracking-normal">
                            {project.label}
                          </span>
                          <span className="tabular-nums text-[10px] text-[var(--zt-muted)]">
                            {project.categories.reduce((count, category) => count + category.pages.length, 0)}
                          </span>
                        </button>
                        {!collapsedProject ? (
                          <div className="ml-3 flex flex-col gap-1 border-l border-[var(--zt-outline)] pl-2">
                            {project.categories.map((category) => {
                              const categoryNodeKey = `${project.key}:${category.key}`;
                              const collapsedCategory = collapsedCategories.has(categoryNodeKey);

                              return (
                                <div key={categoryNodeKey} className="flex flex-col gap-1">
                                  <button
                                    type="button"
                                    onClick={() => toggleCategory(categoryNodeKey)}
                                    className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-xs font-medium text-[var(--zt-muted-strong)] hover:bg-[var(--zt-surface-strong)]"
                                  >
                                    {collapsedCategory ? (
                                      <ChevronRight className="size-3.5" />
                                    ) : (
                                      <ChevronDown className="size-3.5" />
                                    )}
                                    <Hash className="size-3.5 text-[var(--zt-muted)]" />
                                    <span className="flex-1 truncate">{category.label}</span>
                                    <span className="tabular-nums text-[10px] text-[var(--zt-muted)]">
                                      {category.pages.length}
                                    </span>
                                  </button>
                                  {!collapsedCategory ? (
                                    <ul className="ml-3 flex flex-col border-l border-[var(--zt-outline)] pl-1">
                                      {category.pages.map((page) => {
                                        const isActive = page.id === activeSelectedId;
                                        return (
                                          <li key={page.id}>
                                            <button
                                              type="button"
                                              onClick={() => setSelectedId(page.id)}
                                              className={cn(
                                                "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm",
                                                isActive
                                                  ? "bg-[var(--zt-primary-pale)] text-[var(--zt-primary)]"
                                                  : "text-[var(--zt-foreground)] hover:bg-[var(--zt-surface-strong)]",
                                              )}
                                            >
                                              <FileText className="size-3.5 shrink-0 opacity-70" />
                                              <span className="truncate">{page.title}</span>
                                            </button>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </nav>
              )}
            </div>
          </aside>

          <section
            className={cn(
              "min-h-[calc(100dvh-57px)] px-4 py-6 sm:px-10",
              forceSplitLayout ? "lg:px-10" : "lg:px-12",
            )}
          >
            {selectedPage ? (
              <PageViewer
                page={selectedPage}
                relatedPages={relatedPages}
                sourceFacts={sourceFacts}
                sourceFactCount={selectedFactIds.length}
                isSourceFactsLoading={isSelectedFactsLoading}
                hasSourceFactsError={Boolean(selectedFactsError)}
                pageKeyToIdMap={pageKeyToIdMap}
                onNavigate={(id) => setSelectedId(id)}
              />
            ) : isLoading ? (
              <div className="flex h-full items-center justify-center py-20 text-sm text-[var(--zt-muted)]">
                <LoaderCircle className="mr-2 size-4 animate-spin text-[var(--zt-primary)]" />
                読み込み中
              </div>
            ) : (
              <EmptyState
                title="表示できるページがありません。"
                body="Ingest を実行すると Fact から自動的に wiki page が生成されます。"
              />
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function PageViewer({
  page,
  relatedPages,
  sourceFacts,
  sourceFactCount,
  isSourceFactsLoading,
  hasSourceFactsError,
  pageKeyToIdMap,
  onNavigate,
}: {
  page: WikiPage;
  relatedPages: WikiPage[];
  sourceFacts: FactRecord[];
  sourceFactCount: number;
  isSourceFactsLoading: boolean;
  hasSourceFactsError: boolean;
  pageKeyToIdMap: Map<string, string>;
  onNavigate: (id: string) => void;
}) {
  const bodyNodes = useMemo(
    () => renderBody(page.body, page.id, pageKeyToIdMap, onNavigate),
    [onNavigate, page.body, page.id, pageKeyToIdMap],
  );

  return (
    <article className="mx-auto w-full max-w-3xl">
      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--zt-muted)]">
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--zt-surface-strong)] px-2.5 py-1">
          <Folder className="size-3" />
          {resolveProjectLabel(page)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--zt-surface-strong)] px-2.5 py-1">
          <Hash className="size-3" />
          {resolveCategoryLabel(page)}
        </span>
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--zt-primary-pale)] px-2.5 py-1 font-semibold text-[var(--zt-primary)]">
          <Tag className="size-3" />
          {page.kind?.trim() || "kind未設定"}
        </span>
        <span className="rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-2.5 py-1">
          page_key {resolvePageKeyLabel(page)}
        </span>
        <span className="rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-2.5 py-1">
          v{page.version ?? 1}
        </span>
        <span className="rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-2.5 py-1">
          sources {page.source_fact_ids?.length ?? 0}
        </span>
      </div>

      <h1 className="mt-4 text-balance text-3xl font-semibold leading-tight sm:text-4xl">
        {page.title}
      </h1>

      <div className="mt-6 space-y-4 text-[15px] leading-7 text-[var(--zt-foreground)]">
        {bodyNodes.length === 0 ? (
          <p className="text-sm text-[var(--zt-muted)]">
            本文がまだありません。
          </p>
        ) : (
          bodyNodes
        )}
      </div>

      {relatedPages.length > 0 ? (
        <section className="mt-10 rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-5 py-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--zt-muted)]">
            同じプロジェクトのページ
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {relatedPages.map((relatedPage) => (
              <li key={relatedPage.id}>
                <button
                  type="button"
                  onClick={() => onNavigate(relatedPage.id)}
                  className="flex w-full items-start gap-2 rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface)] px-3 py-3 text-left hover:bg-[var(--zt-surface-strong)]"
                >
                  <FileText className="mt-0.5 size-3.5 shrink-0 text-[var(--zt-muted)]" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-[var(--zt-foreground)]">
                      {relatedPage.title}
                    </span>
                    <span className="mt-1 block truncate text-xs text-[var(--zt-muted)]">
                      {resolveCategoryLabel(relatedPage)} / {resolvePageKeyLabel(relatedPage)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {sourceFactCount > 0 ? (
        <section className="mt-6 rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface)] px-5 py-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--zt-muted)]">
            根拠となる Fact
          </h2>
          {hasSourceFactsError ? (
            <p className="mt-3 text-sm text-rose-600">
              Fact の取得に失敗しました。時間をおいて再読み込みしてください。
            </p>
          ) : isSourceFactsLoading ? (
            <p className="mt-3 inline-flex items-center gap-2 text-sm text-[var(--zt-muted)]">
              <LoaderCircle className="size-4 animate-spin text-[var(--zt-primary)]" />
              Fact を読み込み中...
            </p>
          ) : sourceFacts.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--zt-muted)]">
              参照 Fact を取得できませんでした。
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-[var(--zt-outline)]">
              {sourceFacts.map((fact) => (
                <li key={fact.id} className="flex flex-col gap-1 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--zt-muted)]">
                    <span className="rounded-full bg-[var(--zt-surface-strong)] px-2 py-0.5 font-semibold text-[var(--zt-muted-strong)]">
                      Lv.{fact.importance_level ?? 0}
                    </span>
                    {fact.ttl_type ? (
                      <span className="rounded-full bg-[var(--zt-surface-strong)] px-2 py-0.5 uppercase">
                        {fact.ttl_type}
                      </span>
                    ) : null}
                    {(fact.categories ?? []).slice(0, 3).map((category) => (
                      <span
                        key={`${fact.id}-${category}`}
                        className="rounded-full bg-[var(--zt-surface-strong)] px-2 py-0.5"
                      >
                        {category}
                      </span>
                    ))}
                    <span className="ml-auto tabular-nums">{fact.id.slice(0, 8)}</span>
                  </div>
                  <p className="text-sm leading-6 text-[var(--zt-foreground)]">
                    {fact.fact_text}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <footer className="mt-8 flex flex-wrap gap-3 text-xs text-[var(--zt-muted)]">
        <span>updated {formatDateTime(page.updated_at)}</span>
        <span>created {formatDateTime(page.created_at)}</span>
        {page.last_ingest_at ? (
          <span>last ingest {formatDateTime(page.last_ingest_at)}</span>
        ) : null}
      </footer>
    </article>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--zt-outline-strong)] bg-[var(--zt-surface)] px-8 py-20 text-center">
      <p className="text-pretty text-base font-medium text-[var(--zt-foreground)]">
        {title}
      </p>
      <p className="mt-2 text-sm text-[var(--zt-muted)]">{body}</p>
    </div>
  );
}

function renderBody(
  body: string,
  pageId: string,
  pageKeyToIdMap: Map<string, string>,
  onNavigate: (id: string) => void,
) {
  if (!body?.trim()) return [] as ReactNode[];

  const paragraphs = body.split(/\n{2,}/);
  return paragraphs
    .map((paragraph, paragraphIndex) => {
      const lines = paragraph.split(/\n/);
      const isBulletBlock = lines.every((line) => /^\s*[-・*]\s+/.test(line));

      if (isBulletBlock) {
        return (
          <ul key={`${pageId}-p${paragraphIndex}`} className="ml-5 list-disc space-y-1.5">
            {lines.map((line, lineIndex) => {
              const text = line.replace(/^\s*[-・*]\s+/, "");
              return (
                <li key={`${pageId}-p${paragraphIndex}-l${lineIndex}`}>
                  {renderInline(text, pageId, paragraphIndex, lineIndex, pageKeyToIdMap, onNavigate)}
                </li>
              );
            })}
          </ul>
        );
      }

      return (
        <p key={`${pageId}-p${paragraphIndex}`}>
          {lines.map((line, lineIndex) => (
            <span key={`${pageId}-p${paragraphIndex}-l${lineIndex}`}>
              {renderInline(line, pageId, paragraphIndex, lineIndex, pageKeyToIdMap, onNavigate)}
              {lineIndex < lines.length - 1 ? <br /> : null}
            </span>
          ))}
        </p>
      );
    });
}

function renderInline(
  text: string,
  pageId: string,
  paragraphIndex: number,
  lineIndex: number,
  pageKeyToIdMap: Map<string, string>,
  onNavigate: (id: string) => void,
) {
  if (!text) return text;

  const pattern = /\[\[([^\]]+)\]\]/g;
  const segments: Array<string | { pageKey: string; id: string | null }> = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) {
      segments.push(text.slice(cursor, match.index));
    }
    const pageKey = match[1].trim();
    const targetId = pageKeyToIdMap.get(pageKey.toLowerCase()) ?? null;
    segments.push({ pageKey, id: targetId });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    segments.push(text.slice(cursor));
  }

  if (segments.length === 0) segments.push(text);

  return segments.map((segment, segmentIndex) => {
    const key = `${pageId}-p${paragraphIndex}-l${lineIndex}-s${segmentIndex}`;
    if (typeof segment === "string") {
      return <span key={key}>{segment}</span>;
    }
    if (segment.id) {
      return (
        <button
          key={key}
          type="button"
          onClick={() => onNavigate(segment.id!)}
          className="rounded px-0.5 font-medium text-[var(--zt-primary)] underline decoration-[var(--zt-primary-soft)] decoration-2 underline-offset-2 hover:decoration-[var(--zt-primary)]"
        >
          {segment.pageKey}
        </button>
      );
    }
    return (
      <span
        key={key}
        className="rounded bg-rose-50 px-0.5 text-rose-600"
        title="リンク先のページが見つかりません"
      >
        {segment.pageKey}
      </span>
    );
  });
}

function resolveProjectBucketKey(page: Pick<WikiPage, "project_id" | "project_key">) {
  return page.project_id?.trim() || page.project_key?.trim() || NO_PROJECT_KEY;
}

function resolveCategoryBucketKey(page: Pick<WikiPage, "category">) {
  return page.category?.trim() || NO_CATEGORY_KEY;
}

function resolveProjectLabel(page: Pick<WikiPage, "project_name" | "project_key">) {
  return page.project_name?.trim() || page.project_key?.trim() || "未分類プロジェクト";
}

function resolveCategoryLabel(page: Pick<WikiPage, "category">) {
  return page.category?.trim() || "未分類カテゴリ";
}

function resolvePageKeyLabel(page: Pick<WikiPage, "page_key">) {
  return page.page_key?.trim() || "page_key未設定";
}

function compareBucketLabels(
  left: { label: string; isMissing: boolean },
  right: { label: string; isMissing: boolean },
) {
  if (left.isMissing && !right.isMissing) return 1;
  if (right.isMissing && !left.isMissing) return -1;
  return left.label.localeCompare(right.label, "ja");
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
