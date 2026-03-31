import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  BrainCircuit,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Files,
  Gauge,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import type { StatefulArtifactsBundle } from "@/lib/stateful-artifacts";
import { cn } from "@/lib/cn";

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

function SectionCard({
  title,
  eyebrow,
  description,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-[var(--zt-outline)] bg-[var(--zt-surface)] p-5 shadow-sm sm:p-6",
        className,
      )}
    >
      <div className="space-y-1">
        {eyebrow ? (
          <p className="text-xs font-medium text-[var(--zt-muted)]">{eyebrow}</p>
        ) : null}
        <h2 className="text-balance text-xl font-semibold text-[var(--zt-foreground)]">{title}</h2>
        {description ? (
          <p className="text-pretty text-sm leading-6 text-[var(--zt-muted)]">{description}</p>
        ) : null}
      </div>
      <div className="mt-5">{children}</div>
    </section>
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
          <h1 className="mt-5 text-balance text-3xl font-semibold">stateful artifact がまだありません。</h1>
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-6 text-[var(--zt-muted)]">
            `app/android-zero-touch/experiments/amical/artifacts/daily-rollups` に
            `08/09/10/11/12` artifact を生成すると、この viewer で日次の stateful 分析を読めます。
          </p>
          <div className="mt-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-2 text-sm font-medium text-[var(--zt-foreground)]"
            >
              既存のライブ viewer に戻る
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export function StatefulDailyViewer({ bundle }: { bundle: StatefulArtifactsBundle }) {
  if (!bundle.selectedDate) {
    return <EmptyState />;
  }

  const baseDaily = bundle.baseDaily;
  const statefulDaily = bundle.statefulDaily;
  const contextBundle = bundle.contextBundle;
  const activeStateSnapshot = bundle.activeStateSnapshot;
  const stateDelta = bundle.stateDelta;

  const activeTasks = activeStateSnapshot?.active_tasks ?? [];
  const decisionLog = activeStateSnapshot?.decision_log ?? [];
  const durableKnowledge = activeStateSnapshot?.durable_knowledge ?? [];

  return (
    <main className="min-h-dvh bg-[var(--zt-background)] px-4 py-4 text-[var(--zt-foreground)] sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <section className="rounded-[32px] border border-[var(--zt-outline)] bg-[var(--zt-surface)] p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--zt-surface-strong)] px-3 py-1 text-xs font-semibold text-[var(--zt-muted-strong)]">
                <BrainCircuit className="size-3.5 text-[var(--zt-primary)]" />
                ZeroTouch Stateful Viewer
              </div>
              <div className="space-y-2">
                <h1 className="text-balance text-[2rem] font-semibold leading-tight sm:text-[2.75rem]">
                  数日分の会話分析が、翌日の読み方をどう変えるかを見る。
                </h1>
                <p className="text-pretty text-sm leading-6 text-[var(--zt-muted)] sm:text-[15px]">
                  `daily rollup`、`context bundle`、`active state snapshot`、`state delta` をまとめて見せる、
                  人間用の value validation viewer です。リアルタイム監視ではなく、stateful な読み味を検証します。
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                {bundle.availableDates.map((date) => {
                  const isActive = date === bundle.selectedDate;
                  return (
                    <Link
                      key={date}
                      href={`/stateful?date=${date}`}
                      className={cn(
                        "rounded-full border px-4 py-2 text-sm font-medium",
                        isActive
                          ? "border-[var(--zt-primary-soft)] bg-[var(--zt-primary-pale)] text-[var(--zt-primary)]"
                          : "border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] text-[var(--zt-muted-strong)]",
                      )}
                    >
                      {date}
                    </Link>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-2 text-sm font-medium text-[var(--zt-foreground)]"
                >
                  ライブ viewer
                  <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Active Tasks" value={activeTasks.length} icon={ClipboardList} />
            <StatCard label="Decisions" value={decisionLog.length} icon={CheckCircle2} />
            <StatCard label="Knowledge" value={durableKnowledge.length} icon={BookOpenText} />
            <StatCard
              label="State Delta"
              value={
                (stateDelta?.task_mutations?.length ?? 0) +
                (stateDelta?.decision_mutations?.length ?? 0) +
                (stateDelta?.knowledge_mutations?.length ?? 0)
              }
              icon={RefreshCcw}
            />
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <SectionCard
            title="1. Stateful Daily"
            eyebrow="Human-readable output"
            description="その日を『前日までの状態込み』で読ませる中核セクション。"
          >
            {statefulDaily ? (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-balance text-2xl font-semibold">{statefulDaily.headline}</h3>
                  <p className="text-pretty text-sm leading-6 text-[var(--zt-muted)]">{statefulDaily.abstract}</p>
                  <p className="text-pretty rounded-2xl bg-[var(--zt-surface-soft)] px-4 py-3 text-sm leading-6 text-[var(--zt-muted-strong)]">
                    {statefulDaily.status_summary}
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-[var(--zt-muted-strong)]">
                      1-2. Continuing Priorities
                    </h4>
                    <p className="text-pretty text-xs text-[var(--zt-muted)]">
                      前日までの重要事項。翌日の解釈に必須な圧縮コンテクスト。
                    </p>
                    <ul className="space-y-2">
                      {(statefulDaily.continuing_priorities ?? []).map((item) => (
                        <li
                          key={item}
                          className="rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-3 text-sm text-[var(--zt-foreground)]"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                    <article className="rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] p-4">
                      <p className="text-sm text-[var(--zt-muted)]">1-3. Carried-over Tasks</p>
                      <p className="mt-1 text-xs text-[var(--zt-muted)]">
                        前日から継続しているタスク数。
                      </p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums">
                        {statefulDaily.carried_over_tasks?.length ?? 0}
                      </p>
                    </article>
                    <article className="rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] p-4">
                      <p className="text-sm text-[var(--zt-muted)]">1-4. Newly Opened Tasks</p>
                      <p className="mt-1 text-xs text-[var(--zt-muted)]">
                        その日に新規で立ったタスク数。
                      </p>
                      <p className="mt-2 text-2xl font-semibold tabular-nums">
                        {statefulDaily.newly_opened_tasks?.length ?? 0}
                      </p>
                    </article>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-[var(--zt-muted-strong)]">1-5. Main Threads</h4>
                  <p className="text-pretty text-xs text-[var(--zt-muted)]">
                    その日の主要論点をまとめた「読み物」用の章立て。
                  </p>
                  <div className="grid gap-3">
                    {(statefulDaily.main_threads ?? []).map((thread) => (
                      <article
                        key={thread.thread_id ?? thread.title}
                        className="rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] p-4"
                      >
                        <h5 className="text-balance text-base font-semibold">{thread.title}</h5>
                        <p className="mt-2 text-pretty text-sm leading-6 text-[var(--zt-muted)]">{thread.summary}</p>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-pretty text-sm text-[var(--zt-muted)]">
                `10_stateful_daily_rollup.json` がまだありません。まず Android 側で stateful daily を生成してください。
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="2. Context In"
            eyebrow="What the next day inherits"
            description="翌日に渡す圧縮文脈。context bundle の中身を可視化。"
          >
            {contextBundle ? (
              <div className="space-y-5">
                <div className="rounded-2xl bg-[var(--zt-surface-soft)] px-4 py-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-[var(--zt-muted-strong)]">
                    <CalendarRange className="size-4" />
                    2-2. Bundle Date {contextBundle.bundle_date}
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--zt-muted-strong)]">2-3. Recent Chronology</h4>
                  <p className="mt-2 whitespace-pre-wrap text-pretty text-sm leading-6 text-[var(--zt-muted)]">
                    {contextBundle.recent_chronology_summary}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--zt-muted-strong)]">2-4. Priority Items</h4>
                  <ul className="mt-2 space-y-2">
                    {(contextBundle.priority_items ?? []).map((item) => (
                      <li
                        key={item}
                        className="rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-3 text-sm"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ) : (
              <p className="text-pretty text-sm text-[var(--zt-muted)]">
                `09_context_bundle.json` がまだありません。
              </p>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard
            title="3. Baseline vs Stateful"
            eyebrow="Does context change the reading?"
            description="文脈なしの日報と stateful 日報の差分を比較する区画。"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <article className="rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] p-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-[var(--zt-surface)] px-3 py-1 text-xs font-medium text-[var(--zt-muted-strong)]">
                  <Gauge className="size-3.5" />
                  3-2. Baseline Daily
                </div>
                {baseDaily ? (
                  <div className="mt-4 space-y-2">
                    <h3 className="text-balance text-lg font-semibold">{baseDaily.headline}</h3>
                    <p className="text-pretty text-sm leading-6 text-[var(--zt-muted)]">{baseDaily.abstract}</p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[var(--zt-muted)]">`08_daily_rollup.json` がありません。</p>
                )}
              </article>

              <article className="rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] p-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-[var(--zt-surface)] px-3 py-1 text-xs font-medium text-[var(--zt-muted-strong)]">
                  <Sparkles className="size-3.5 text-[var(--zt-primary)]" />
                  3-3. Stateful Daily
                </div>
                {statefulDaily ? (
                  <div className="mt-4 space-y-2">
                    <h3 className="text-balance text-lg font-semibold">{statefulDaily.headline}</h3>
                    <p className="text-pretty text-sm leading-6 text-[var(--zt-muted)]">{statefulDaily.abstract}</p>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[var(--zt-muted)]">`10_stateful_daily_rollup.json` がありません。</p>
                )}
              </article>
            </div>
          </SectionCard>

          <SectionCard
            title="4. State Delta"
            eyebrow="What changed today"
            description="その日に state がどう変わったかを mutation 単位で見る区画。"
          >
            {stateDelta ? (
              <div className="grid gap-4 md:grid-cols-3">
                <MutationList
                  title="4-2. Tasks"
                  rows={(stateDelta.task_mutations ?? []).map((item, index) => ({
                    key: `${item.task_id ?? item.title ?? "task"}-${item.mutation}-${index}`,
                    tone: item.mutation,
                    title: item.title ?? item.task_id ?? "task",
                    detail: item.reason,
                  }))}
                />
                <MutationList
                  title="4-3. Decisions"
                  rows={(stateDelta.decision_mutations ?? []).map((item, index) => ({
                    key: `${item.decision_id ?? item.statement ?? "decision"}-${item.mutation}-${index}`,
                    tone: item.mutation,
                    title: item.statement ?? item.decision_id ?? "decision",
                    detail: item.reason,
                  }))}
                />
                <MutationList
                  title="4-4. Knowledge"
                  rows={(stateDelta.knowledge_mutations ?? []).map((item, index) => ({
                    key: `${item.knowledge_id ?? item.title ?? "knowledge"}-${item.mutation}-${index}`,
                    tone: item.mutation,
                    title: item.title ?? item.knowledge_id ?? "knowledge",
                    detail: item.reason,
                  }))}
                />
              </div>
            ) : (
              <p className="text-pretty text-sm text-[var(--zt-muted)]">
                `11_state_delta.json` がまだありません。
              </p>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <SectionCard
            title="5. Active State Snapshot"
            eyebrow="What the system currently believes"
            description="現在の正本。タスク・決定・知識の数と状態を確認する。"
          >
            {activeStateSnapshot ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <article className="rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] p-4">
                  <p className="text-sm text-[var(--zt-muted)]">5-2. Active Tasks</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{activeTasks.length}</p>
                </article>
                <article className="rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] p-4">
                  <p className="text-sm text-[var(--zt-muted)]">5-3. Decision Log</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{decisionLog.length}</p>
                </article>
                <article className="rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] p-4">
                  <p className="text-sm text-[var(--zt-muted)]">5-4. Durable Knowledge</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{durableKnowledge.length}</p>
                </article>
              </div>
            ) : (
              <p className="text-pretty text-sm text-[var(--zt-muted)]">
                `12_active_state_snapshot.json` がまだありません。
              </p>
            )}
          </SectionCard>

          <SectionCard
            title="6. Top of State"
            eyebrow="Reader-oriented slices"
            description="現在の state を人間が読むために上位だけ抜き出したビュー。"
          >
            <div className="grid gap-4 lg:grid-cols-3">
              <MiniList
                title="6-2. Tasks"
                rows={activeTasks.slice(0, 6).map((task) => ({
                  key: task.task_id ?? task.title,
                  title: task.title,
                  meta: task.summary,
                }))}
              />
              <MiniList
                title="6-3. Decisions"
                rows={decisionLog.slice(0, 6).map((decision) => ({
                  key: decision.decision_id ?? decision.statement,
                  title: decision.statement,
                  meta: decision.last_confirmed_at ?? "",
                }))}
              />
              <MiniList
                title="6-4. Knowledge"
                rows={durableKnowledge.slice(0, 6).map((knowledge) => ({
                  key: knowledge.knowledge_id ?? knowledge.title,
                  title: `[${knowledge.category}] ${knowledge.title}`,
                  meta: knowledge.summary,
                }))}
              />
            </div>
          </SectionCard>
        </div>
      </div>
    </main>
  );
}

function MutationList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; tone: string; title: string; detail?: string }>;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-[var(--zt-muted-strong)]">{title}</h4>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-2xl bg-[var(--zt-surface-soft)] px-4 py-3 text-sm text-[var(--zt-muted)]">
            (none)
          </p>
        ) : (
          rows.map((row) => (
            <article
              key={row.key}
              className="rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-pretty text-sm font-medium">{row.title}</p>
                <span className="rounded-full bg-[var(--zt-surface)] px-2.5 py-1 text-xs font-medium text-[var(--zt-muted-strong)]">
                  {row.tone}
                </span>
              </div>
              {row.detail ? (
                <p className="mt-2 text-pretty text-sm leading-6 text-[var(--zt-muted)]">{row.detail}</p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function MiniList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; title: string; meta: string }>;
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-[var(--zt-muted-strong)]">{title}</h4>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-2xl bg-[var(--zt-surface-soft)] px-4 py-3 text-sm text-[var(--zt-muted)]">
            (none)
          </p>
        ) : (
          rows.map((row) => (
            <article key={row.key} className="rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-3">
              <p className="text-pretty text-sm font-medium">{row.title}</p>
              <p className="mt-2 text-pretty text-sm leading-6 text-[var(--zt-muted)]">{row.meta}</p>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
