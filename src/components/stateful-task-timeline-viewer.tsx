import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  ClipboardList,
  Files,
  Gauge,
  RefreshCcw,
  Sparkles,
} from "lucide-react";
import { StatefulViewLinks } from "@/components/stateful-view-links";
import type {
  DailyDecision,
  DailySourceSpot,
  DailyTask,
  StateDelta,
  StatefulArtifactsBundle,
  StatefulDailyRollup,
} from "@/lib/stateful-artifacts";
import { cn } from "@/lib/cn";

type TimelineEvent = {
  id: string;
  type: "thread" | "decision" | "task" | "knowledge";
  label: string;
  title: string;
  detail: string;
  spotId?: string;
  spotLabel?: string;
  spotHeadline?: string;
  order: number;
  priority?: string;
  mutation?: string;
  refs?: string[];
  timeKey: string;
  timeLabel: string;
  timeSort: number;
};

const PRIORITY_ORDER: Record<string, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const TIMELINE_TYPE_STYLES: Record<TimelineEvent["type"], string> = {
  thread: "border-stone-300 bg-stone-100 text-stone-700",
  decision: "border-emerald-300 bg-emerald-50 text-emerald-700",
  task: "border-blue-300 bg-blue-50 text-blue-700",
  knowledge: "border-amber-300 bg-amber-50 text-amber-700",
};

const MUTATION_STYLES: Record<string, string> = {
  create: "border-blue-300 bg-blue-50 text-blue-700",
  touch: "border-amber-300 bg-amber-50 text-amber-700",
  update: "border-amber-300 bg-amber-50 text-amber-700",
  close: "border-emerald-300 bg-emerald-50 text-emerald-700",
  reopen: "border-violet-300 bg-violet-50 text-violet-700",
};

type TimelineGroup = {
  key: string;
  label: string;
  headline?: string;
  events: TimelineEvent[];
  sortKey: number;
};

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
          <h1 className="mt-5 text-balance text-3xl font-semibold">task timeline 用 artifact がまだありません。</h1>
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-6 text-[var(--zt-muted)]">
            `10_stateful_daily_rollup`、`11_state_delta`、`12_active_state_snapshot` を生成すると、
            タスク中心の viewer で「今やること」と「何が起きたか」を検証できます。
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/stateful"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-2 text-sm font-medium text-[var(--zt-foreground)]"
            >
              Stateful analysis
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-2 text-sm font-medium text-[var(--zt-foreground)]"
            >
              ライブ viewer
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export function StatefulTaskTimelineViewer({ bundle }: { bundle: StatefulArtifactsBundle }) {
  if (!bundle.selectedDate) {
    return <EmptyState />;
  }

  const selectedDate = bundle.selectedDate;
  const statefulDaily = bundle.statefulDaily;
  const activeStateSnapshot = bundle.activeStateSnapshot;
  const stateDelta = bundle.stateDelta;
  const activeTasks = [...(activeStateSnapshot?.active_tasks ?? [])].sort(compareTasks);
  const timelineEvents = buildTimelineEvents(statefulDaily, stateDelta);
  const timelineEventOnly = timelineEvents.filter((event) => event.type !== "task");
  const timelineGroups = groupTimelineEvents(timelineEventOnly);
  const changeLogRows = (stateDelta?.task_mutations ?? []).filter((item) => item.mutation !== "create");
  const carriedOverCount = activeTasks.filter(
    (task) => task.first_seen_at && !task.first_seen_at.startsWith(selectedDate),
  ).length;
  const newlyOpenedCount = statefulDaily?.newly_opened_tasks?.length ?? 0;

  return (
    <main className="min-h-dvh bg-[var(--zt-background)] px-4 py-4 text-[var(--zt-foreground)] sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <section className="rounded-[32px] border border-[var(--zt-outline)] bg-[var(--zt-surface)] p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--zt-surface-strong)] px-3 py-1 text-xs font-semibold text-[var(--zt-muted-strong)]">
                <ClipboardList className="size-3.5 text-[var(--zt-primary)]" />
                ZeroTouch Task Timeline
              </div>
              <div className="space-y-2">
                <h1 className="text-balance text-[2rem] font-semibold leading-tight sm:text-[2.75rem]">
                  その日に何が起きて、今なにを進めるべきかを 1 画面で読む。
                </h1>
                <p className="text-pretty text-sm leading-6 text-[var(--zt-muted)] sm:text-[15px]">
                  `active state snapshot` の現在タスクと、`stateful daily` / `state delta` の出来事を重ねて、
                  エンドユーザーが次の行動にすぐ移れるかを検証するページです。
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                {bundle.availableDates.map((date) => {
                  const isActive = date === selectedDate;
                  return (
                    <Link
                      key={date}
                      href={`/stateful/tasks?date=${date}`}
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
              <StatefulViewLinks active="tasks" date={selectedDate} />
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
            <StatCard label="Open Tasks" value={activeTasks.length} icon={ClipboardList} />
            <StatCard label="New Today" value={newlyOpenedCount} icon={Sparkles} />
            <StatCard label="Timeline Events" value={timelineEventOnly.length} icon={CalendarRange} />
            <StatCard label="Change Log" value={changeLogRows.length} icon={RefreshCcw} />
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <SectionCard
            title="1. Active Tasks"
            eyebrow="What should happen next"
            description="現在 open のタスクを優先度順で並べ、今日立ったものと継続案件を同じ面で読む。"
          >
            {activeTasks.length === 0 ? (
              <p className="rounded-2xl bg-[var(--zt-surface-soft)] px-4 py-3 text-sm text-[var(--zt-muted)]">
                active task はまだありません。
              </p>
            ) : (
              <div className="grid gap-3">
                {activeTasks.map((task, index) => {
                  const key = makeStableKey(index, task.task_id, task.task_key, task.title);
                  return <TaskCard key={key} task={task} selectedDate={selectedDate} />;
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="2. Reader Summary"
            eyebrow="What this day means"
            description="その日のステータス要約と、翌日に持ち越すべき優先事項を読む補助列。"
          >
            <div className="space-y-4">
              <article className="rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-[var(--zt-muted-strong)]">
                  <Gauge className="size-4" />
                  Status Summary
                </div>
                <p className="mt-3 text-pretty text-sm leading-6 text-[var(--zt-muted)]">
                  {statefulDaily?.status_summary ?? "stateful daily がまだありません。"}
                </p>
              </article>

              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <MiniStat label="Carried Over" value={carriedOverCount} />
                <MiniStat label="Decisions Today" value={statefulDaily?.decisions_today?.length ?? 0} />
                <MiniStat label="Snapshot Time" value={formatCompactDate(activeStateSnapshot?.generated_at)} />
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-[var(--zt-muted-strong)]">Continuing Priorities</h3>
                {(statefulDaily?.continuing_priorities ?? []).length === 0 ? (
                  <p className="rounded-2xl bg-[var(--zt-surface-soft)] px-4 py-3 text-sm text-[var(--zt-muted)]">
                    continuing priority はまだありません。
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {(statefulDaily?.continuing_priorities ?? []).map((item) => (
                      <li
                        key={item}
                        className="rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-3 text-sm leading-6"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="3. Event Timeline"
          eyebrow="What happened today"
          description="main thread、decision、state mutation を同じ時系列フィードに落として、その日の流れを人間が追えるようにする。"
        >
          {timelineGroups.length === 0 ? (
            <p className="rounded-2xl bg-[var(--zt-surface-soft)] px-4 py-3 text-sm text-[var(--zt-muted)]">
              timeline event はまだありません。
            </p>
          ) : (
            <div className="space-y-6">
              {timelineGroups.map((group) => (
                <div key={group.key} className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface)] px-3 py-1 text-xs font-semibold text-[var(--zt-muted-strong)]">
                      {group.label}
                    </span>
                    {group.headline ? (
                      <p className="text-pretty text-xs text-[var(--zt-muted)]">{group.headline}</p>
                    ) : null}
                  </div>
                  {group.events.length === 0 ? (
                    <p className="rounded-2xl bg-[var(--zt-surface-soft)] px-4 py-3 text-sm text-[var(--zt-muted)]">
                      (no events)
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {group.events.map((event, index, list) => (
                        <TimelineEventCard
                          key={event.id}
                          event={event}
                          isLast={index === list.length - 1}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="4. Completion / Update Log"
          eyebrow="What moved, closed, or was touched"
          description="create 以外の task mutation を下段に分離し、完了・更新・再確認のログとして見る。"
        >
          {changeLogRows.length === 0 ? (
            <p className="rounded-2xl bg-[var(--zt-surface-soft)] px-4 py-3 text-sm text-[var(--zt-muted)]">
              まだ close / update 系の mutation はありません。今の出力は新規 task の抽出が中心です。
            </p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {changeLogRows.map((item, index) => (
                <article
                  key={makeStableKey(index, item.task_id, item.task_key, item.title, item.mutation)}
                  className="rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium",
                        MUTATION_STYLES[item.mutation] ?? "border-stone-300 bg-stone-100 text-stone-700",
                      )}
                    >
                      {item.mutation}
                    </span>
                    {item.priority ? <PriorityPill priority={item.priority} /> : null}
                    {item.task_kind ? <MetaPill>{item.task_kind}</MetaPill> : null}
                  </div>
                  <h3 className="mt-3 text-balance text-base font-semibold">{item.title ?? item.task_key ?? "task"}</h3>
                  {item.summary ? (
                    <p className="mt-2 text-pretty text-sm leading-6 text-[var(--zt-muted)]">{item.summary}</p>
                  ) : null}
                  {item.reason ? (
                    <p className="mt-3 text-pretty text-sm leading-6 text-[var(--zt-muted-strong)]">{item.reason}</p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    </main>
  );
}

function TaskCard({ task, selectedDate }: { task: DailyTask & { first_seen_at?: string; last_seen_at?: string; task_kind?: string; task_key?: string; }; selectedDate: string }) {
  const isNewToday = task.first_seen_at?.startsWith(selectedDate) ?? false;

  return (
    <article className="rounded-[24px] border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        {task.priority ? <PriorityPill priority={task.priority} /> : null}
        {task.task_kind ? <MetaPill>{task.task_kind}</MetaPill> : null}
        <MetaPill>{isNewToday ? "new today" : "carried over"}</MetaPill>
      </div>
      <div className="mt-3 space-y-2">
        <h3 className="text-balance text-lg font-semibold">{task.title}</h3>
        <p className="text-pretty text-sm leading-6 text-[var(--zt-muted)]">{task.summary}</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--zt-muted)]">
        <span className="rounded-full bg-[var(--zt-surface)] px-3 py-1 tabular-nums">
          first seen {formatCompactDate(task.first_seen_at)}
        </span>
        <span className="rounded-full bg-[var(--zt-surface)] px-3 py-1 tabular-nums">
          last seen {formatCompactDate(task.last_seen_at)}
        </span>
        <span className="rounded-full bg-[var(--zt-surface)] px-3 py-1 tabular-nums">
          refs {task.source_refs?.length ?? 0}
        </span>
      </div>
    </article>
  );
}

function TimelineEventCard({
  event,
  isLast,
  children,
}: {
  event: TimelineEvent;
  isLast: boolean;
  children?: ReactNode;
}) {
  return (
    <article className="relative pl-8">
      <div className="absolute left-0 top-2.5 flex w-5 justify-center">
        <span className="size-3 rounded-full border-2 border-[var(--zt-background)] bg-[var(--zt-primary)]" />
      </div>
      {!isLast ? (
        <div className="absolute left-2 top-5 h-[calc(100%+0.75rem)] w-px bg-[var(--zt-outline-strong)]" />
      ) : null}
      <div className="rounded-[24px] border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium",
              TIMELINE_TYPE_STYLES[event.type],
            )}
          >
            {event.label}
          </span>
          {event.mutation ? (
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium",
                MUTATION_STYLES[event.mutation] ?? "border-stone-300 bg-stone-100 text-stone-700",
              )}
            >
              {event.mutation}
            </span>
          ) : null}
          {event.priority ? <PriorityPill priority={event.priority} /> : null}
          {event.spotLabel ? <MetaPill>{event.spotLabel}</MetaPill> : null}
        </div>
        <h3 className="mt-3 text-balance text-lg font-semibold">{event.title}</h3>
        <p className="mt-2 text-pretty text-sm leading-6 text-[var(--zt-muted)]">{event.detail}</p>
        {event.refs && event.refs.length > 0 ? (
          <p className="mt-3 text-xs tabular-nums text-[var(--zt-muted)]">refs {event.refs.join(", ")}</p>
        ) : null}
        {children}
      </div>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-2xl border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] p-4">
      <p className="text-sm text-[var(--zt-muted)]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </article>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  const normalized = priority.toLowerCase();
  const className =
    normalized === "high"
      ? "border-rose-300 bg-rose-50 text-rose-700"
      : normalized === "medium"
        ? "border-amber-300 bg-amber-50 text-amber-700"
        : "border-stone-300 bg-stone-100 text-stone-700";

  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", className)}>
      {normalized}
    </span>
  );
}

function MetaPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface)] px-2.5 py-1 text-xs font-medium text-[var(--zt-muted-strong)]">
      {children}
    </span>
  );
}

function compareTasks(
  left: DailyTask & { first_seen_at?: string; last_seen_at?: string },
  right: DailyTask & { first_seen_at?: string; last_seen_at?: string },
) {
  const leftPriority = PRIORITY_ORDER[left.priority?.toLowerCase() ?? ""] ?? 99;
  const rightPriority = PRIORITY_ORDER[right.priority?.toLowerCase() ?? ""] ?? 99;

  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const leftSeen = left.last_seen_at ?? left.first_seen_at ?? "";
  const rightSeen = right.last_seen_at ?? right.first_seen_at ?? "";
  return rightSeen.localeCompare(leftSeen);
}

function buildTimelineEvents(
  statefulDaily: StatefulDailyRollup | null,
  stateDelta: StateDelta | null,
): TimelineEvent[] {
  const spotIndexMap = new Map(
    (statefulDaily?.source_spots ?? []).map((spot, index) => [
      spot.spot_id,
      { index, label: formatSpotLabel(spot), spot },
    ]),
  );

  const threadEvents = (statefulDaily?.main_threads ?? []).map((thread, index) => ({
    id: makeStableKey(index, thread.thread_id, thread.title, "thread"),
    type: "thread" as const,
    label: "Main thread",
    title: thread.title,
    detail: thread.summary,
    spotId: thread.source_spot_ids?.[0],
    refs: thread.source_spot_ids,
    order: index * 10,
  }));

  const decisionEvents = (statefulDaily?.decisions_today ?? []).map((decision, index) => {
    const sourceRefs = decision.source_refs ?? [];
    const fallbackId = `decision-${index}`;
    return {
      id: makeStableKey(index, fallbackId, extractSpotId(sourceRefs)),
      type: "decision" as const,
      label: "Decision",
      title: getDecisionTitle(decision),
      detail: sourceRefs.length > 0 ? "その日の判断として状態に反映された項目です。" : "判断として抽出された項目です。",
      spotId: extractSpotId(sourceRefs),
      refs: sourceRefs,
      order: index * 10 + 1,
    };
  });

  const taskEvents = (stateDelta?.task_mutations ?? []).map((mutation, index) => ({
    id: makeStableKey(index, mutation.task_id, mutation.task_key, mutation.title, "task"),
    type: "task" as const,
    label: "Task delta",
    title: mutation.title ?? mutation.task_key ?? "task mutation",
    detail: mutation.reason ?? mutation.summary ?? "task state が更新されました。",
    spotId: extractSpotId(mutation.source_refs),
    refs: mutation.source_refs,
    mutation: mutation.mutation,
    priority: mutation.priority,
    order: index * 10 + 2,
  }));

  const knowledgeEvents = (stateDelta?.knowledge_mutations ?? []).map((mutation, index) => ({
    id: makeStableKey(index, mutation.knowledge_id, mutation.knowledge_key, mutation.title, "knowledge"),
    type: "knowledge" as const,
    label: "Knowledge delta",
    title: mutation.title ?? mutation.knowledge_key ?? "knowledge mutation",
    detail: mutation.reason ?? mutation.summary ?? "knowledge state が更新されました。",
    spotId: extractSpotId(mutation.source_refs),
    refs: mutation.source_refs,
    mutation: mutation.mutation,
    order: index * 10 + 3,
  }));

  return [...threadEvents, ...decisionEvents, ...taskEvents, ...knowledgeEvents]
    .map((event) => {
      const spotMeta = event.spotId ? spotIndexMap.get(event.spotId) : undefined;
      const timeBucket = resolveTimeBucket(spotMeta?.spot);
      return {
        ...event,
        spotLabel: spotMeta?.label,
        spotHeadline: spotMeta?.spot?.headline,
        timeKey: timeBucket.key,
        timeLabel: timeBucket.label,
        timeSort: timeBucket.sortKey,
        order: (spotMeta?.index ?? 99) * 100 + event.order,
      };
    })
    .sort((left, right) => left.order - right.order);
}

function groupTimelineEvents(events: TimelineEvent[]): TimelineGroup[] {
  const groups = new Map<string, TimelineGroup>();

  for (const event of events) {
    const existing = groups.get(event.timeKey);
    if (existing) {
      existing.events.push(event);
      if (event.timeSort < existing.sortKey) {
        existing.sortKey = event.timeSort;
      }
      if (event.spotHeadline) {
        existing.headline = mergeHeadline(existing.headline, event.spotHeadline);
      }
      continue;
    }

    groups.set(event.timeKey, {
      key: event.timeKey,
      label: event.timeLabel,
      headline: event.spotHeadline,
      events: [event],
      sortKey: event.timeSort,
    });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      events: [...group.events].sort((left, right) => left.order - right.order),
    }))
    .sort((left, right) => left.sortKey - right.sortKey);
}

function mergeHeadline(existing?: string, incoming?: string) {
  if (!incoming) {
    return existing;
  }
  if (!existing) {
    return incoming;
  }
  if (existing === incoming) {
    return existing;
  }
  return `${existing} / ${incoming}`;
}

function resolveTimeBucket(spot?: DailySourceSpot) {
  if (!spot?.start_at) {
    return { key: "unknown", label: "時間未確定", sortKey: Number.MAX_SAFE_INTEGER };
  }

  const date = new Date(spot.start_at);
  if (Number.isNaN(date.getTime())) {
    return { key: "unknown", label: "時間未確定", sortKey: Number.MAX_SAFE_INTEGER };
  }

  const dateKey = formatLocalDateKey(date);
  const hourKey = String(date.getHours()).padStart(2, "0");
  const key = `${dateKey}-${hourKey}`;

  return {
    key,
    label: `${hourKey}時`,
    sortKey: new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()).getTime(),
  };
}

function getDecisionTitle(decision: DailyDecision | { statement: string; source_refs?: string[] }) {
  if ("summary" in decision) {
    return decision.summary;
  }

  return decision.statement;
}

function makeStableKey(index: number, ...values: Array<string | null | undefined>) {
  const candidate = firstNonEmpty(values);
  if (candidate) {
    return candidate;
  }
  return `item-${index}`;
}

function firstNonEmpty(values: Array<string | null | undefined>) {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function extractSpotId(sourceRefs?: string[]) {
  for (const ref of sourceRefs ?? []) {
    const match = ref.match(/^(SPOT-[^:]+)/);
    if (match) {
      return match[1];
    }
  }

  return undefined;
}

function formatSpotLabel(spot: DailySourceSpot) {
  if (!spot.start_at) {
    return spot.spot_id;
  }

  const start = formatTimeOnly(spot.start_at);
  const end = spot.end_at ? formatTimeOnly(spot.end_at) : null;
  return end ? `${spot.spot_id} ${start}-${end}` : `${spot.spot_id} ${start}`;
}

function formatLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCompactDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTimeOnly(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
