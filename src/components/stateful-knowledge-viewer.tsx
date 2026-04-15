import type { ComponentType } from "react";
import Link from "next/link";
import { BookOpenText, Files, Layers3, LibraryBig, Sparkles } from "lucide-react";
import { StatefulViewLinks } from "@/components/stateful-view-links";
import type { DailyKnowledge, StatefulArtifactsBundle } from "@/lib/stateful-artifacts";

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <article className="rounded-3xl border border-[var(--zt-outline)] bg-[var(--zt-surface)] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--zt-muted)]">{label}</p>
        <Icon className="size-4 text-[var(--zt-muted)]" />
      </div>
      <p className="mt-4 text-2xl font-semibold tabular-nums text-[var(--zt-foreground)]">{value}</p>
    </article>
  );
}

function EmptyState() {
  return (
    <main className="min-h-dvh bg-[var(--zt-background)] px-4 py-6 text-[var(--zt-foreground)] sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <section className="rounded-[32px] border border-dashed border-[var(--zt-outline-strong)] bg-[var(--zt-surface)] px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[var(--zt-surface-strong)]">
            <Files className="size-6 text-[var(--zt-muted)]" />
          </div>
          <h1 className="mt-5 text-balance text-3xl font-semibold">knowledge の下地がまだありません。</h1>
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-6 text-[var(--zt-muted)]">
            durable knowledge か updated knowledge が生成されると、カテゴリ別の knowledge 面として読めます。
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/stateful"
              className="rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-2 text-sm font-medium"
            >
              All-in-one viewer
            </Link>
            <Link
              href="/stateful/timeline"
              className="rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-2 text-sm font-medium"
            >
              Timeline
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function categoryLabel(category: string) {
  return category.trim() || "Uncategorized";
}

function buildKnowledgeRows(bundle: StatefulArtifactsBundle): DailyKnowledge[] {
  const snapshotRows = bundle.activeStateSnapshot?.durable_knowledge ?? [];
  const updatedRows = bundle.statefulDaily?.updated_knowledge ?? [];
  const map = new Map<string, DailyKnowledge>();

  for (const row of snapshotRows) {
    const key = row.knowledge_id ?? row.knowledge_key ?? row.title;
    map.set(key, row);
  }

  for (const row of updatedRows) {
    const key = row.knowledge_id ?? row.knowledge_key ?? row.title;
    if (!map.has(key)) {
      map.set(key, row);
    }
  }

  return [...map.values()].sort((left, right) => {
    return categoryLabel(left.category).localeCompare(categoryLabel(right.category), "ja");
  });
}

export function StatefulKnowledgeViewer({ bundle }: { bundle: StatefulArtifactsBundle }) {
  const knowledgeRows = buildKnowledgeRows(bundle);

  if (!bundle.selectedDate || knowledgeRows.length === 0) {
    return <EmptyState />;
  }

  const grouped = knowledgeRows.reduce<Record<string, DailyKnowledge[]>>((acc, row) => {
    const category = categoryLabel(row.category);
    acc[category] ??= [];
    acc[category].push(row);
    return acc;
  }, {});

  return (
    <main className="min-h-dvh bg-[var(--zt-background)] px-4 py-4 text-[var(--zt-foreground)] sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <section className="rounded-[32px] border border-[var(--zt-outline)] bg-[var(--zt-surface)] p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--zt-surface-strong)] px-3 py-1 text-xs font-semibold text-[var(--zt-muted-strong)]">
                <LibraryBig className="size-3.5 text-[var(--zt-primary)]" />
                ZeroTouch Knowledge
              </div>
              <div className="space-y-2">
                <h1 className="text-balance text-[2rem] font-semibold leading-tight sm:text-[2.75rem]">
                  event から残った知識を、カテゴリ単位で読む。
                </h1>
                <p className="text-pretty text-sm leading-6 text-[var(--zt-muted)] sm:text-[15px]">
                  ここは knowledge 面のテンプレートです。今は durable knowledge と updated knowledge を一緒に並べ、
                  将来の knowledge base 画面の骨格として使います。
                </p>
              </div>
              <StatefulViewLinks active="knowledge" date={bundle.selectedDate} />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Knowledge" value={knowledgeRows.length} icon={BookOpenText} />
              <StatCard label="Categories" value={Object.keys(grouped).length} icon={Layers3} />
              <StatCard
                label="Updated Today"
                value={bundle.statefulDaily?.updated_knowledge?.length ?? 0}
                icon={Sparkles}
              />
              <StatCard
                label="Durable"
                value={bundle.activeStateSnapshot?.durable_knowledge?.length ?? 0}
                icon={LibraryBig}
              />
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-[var(--zt-outline)] bg-[var(--zt-surface)] p-5 shadow-sm sm:p-6">
          <div className="space-y-1">
            <p className="text-xs font-medium text-[var(--zt-muted)]">Template Surface</p>
            <h2 className="text-balance text-xl font-semibold">Knowledge by Category</h2>
            <p className="text-pretty text-sm leading-6 text-[var(--zt-muted)]">
              まだ最終設計ではありません。まずは knowledge がカテゴリごとに残り、
              タイトルと要約で一覧できることを確認するためのテンプレートです。
            </p>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {Object.entries(grouped).map(([category, rows]) => (
              <section
                key={category}
                className="rounded-[24px] border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-balance text-base font-semibold">{category}</h3>
                  <span className="rounded-full border border-[var(--zt-outline)] bg-white px-2.5 py-1 text-xs font-medium text-[var(--zt-muted-strong)]">
                    {rows.length}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {rows.map((row) => (
                    <article key={row.knowledge_id ?? row.knowledge_key ?? row.title} className="rounded-2xl border border-[var(--zt-outline)] bg-white px-4 py-3">
                      <p className="text-balance text-sm font-medium text-[var(--zt-foreground)]">{row.title}</p>
                      <p className="mt-2 text-pretty text-sm leading-6 text-[var(--zt-muted)]">{row.summary}</p>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
