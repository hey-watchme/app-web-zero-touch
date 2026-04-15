import type { ComponentType } from "react";
import Link from "next/link";
import {
  BookOpenText,
  CalendarRange,
  ClipboardList,
  Clock3,
  Files,
  Sparkles,
} from "lucide-react";
import { StatefulViewLinks } from "@/components/stateful-view-links";
import { cn } from "@/lib/cn";
import { buildStatefulEvents, maxTimelineLane, type StatefulEvent } from "@/lib/stateful-events";
import type { StatefulArtifactsBundle } from "@/lib/stateful-artifacts";

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const TIMELINE_ROW_HEIGHT = 64;

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
          <h1 className="mt-5 text-balance text-3xl font-semibold">時系列に置ける event がまだありません。</h1>
          <p className="mx-auto mt-3 max-w-2xl text-pretty text-sm leading-6 text-[var(--zt-muted)]">
            `10_stateful_daily_rollup.json` の `source_spots` がある日付を生成すると、
            event timeline を 24 時間の軸に置いて確認できます。
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link
              href="/stateful"
              className="rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-2 text-sm font-medium"
            >
              All-in-one viewer
            </Link>
            <Link
              href="/"
              className="rounded-full border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] px-4 py-2 text-sm font-medium"
            >
              Live viewer
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function hourLabel(hour: number) {
  return `${hour.toString().padStart(2, "0")}:00`;
}

function blockStyle(event: StatefulEvent, laneCount: number) {
  const laneWidth = 100 / laneCount;

  return {
    top: `${(event.startMinute / 1440) * 100}%`,
    height: `${((event.endMinute - event.startMinute) / 1440) * 100}%`,
    left: `calc(${event.lane * laneWidth}% + 0.35rem)`,
    width: `calc(${laneWidth}% - 0.7rem)`,
  };
}

function EventChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "task" | "knowledge" | "decision" | "neutral";
}) {
  const toneClass =
    tone === "task"
      ? "border-blue-200 bg-blue-50 text-blue-700"
      : tone === "knowledge"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : tone === "decision"
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-stone-200 bg-stone-50 text-stone-700";

  return (
    <span className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", toneClass)}>
      {label}
    </span>
  );
}

export function StatefulEventTimeline({ bundle }: { bundle: StatefulArtifactsBundle }) {
  const events = buildStatefulEvents(bundle);

  if (!bundle.selectedDate || events.length === 0) {
    return <EmptyState />;
  }

  const laneCount = maxTimelineLane(events);
  const annotatedEvents = events.filter(
    (event) => event.tasks.length > 0 || event.knowledge.length > 0 || event.decisions.length > 0,
  ).length;
  const totalTasks = events.reduce((sum, event) => sum + event.tasks.length, 0);
  const totalKnowledge = events.reduce((sum, event) => sum + event.knowledge.length, 0);

  return (
    <main className="min-h-dvh bg-[var(--zt-background)] px-4 py-4 text-[var(--zt-foreground)] sm:px-6">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <section className="rounded-[32px] border border-[var(--zt-outline)] bg-[var(--zt-surface)] p-6 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-[var(--zt-surface-strong)] px-3 py-1 text-xs font-semibold text-[var(--zt-muted-strong)]">
                <Clock3 className="size-3.5 text-[var(--zt-primary)]" />
                ZeroTouch Event Timeline
              </div>
              <div className="space-y-2">
                <h1 className="text-balance text-[2rem] font-semibold leading-tight sm:text-[2.75rem]">
                  24時間の軸に、会話から抽出した意味 event を置く。
                </h1>
                <p className="text-pretty text-sm leading-6 text-[var(--zt-muted)] sm:text-[15px]">
                  `Topic` を中立的な `Event` として扱い、まず時間上に配置します。
                  task と knowledge は、その上に重なる annotation として見せます。
                </p>
              </div>
              <StatefulViewLinks active="timeline" date={bundle.selectedDate} />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Events" value={events.length} icon={CalendarRange} />
              <StatCard label="Annotated" value={annotatedEvents} icon={Sparkles} />
              <StatCard label="Tasks" value={totalTasks} icon={ClipboardList} />
              <StatCard label="Knowledge" value={totalKnowledge} icon={BookOpenText} />
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-[28px] border border-[var(--zt-outline)] bg-[var(--zt-surface)] p-5 shadow-sm sm:p-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--zt-muted)]">Primary Surface</p>
              <h2 className="text-balance text-xl font-semibold">Timeline</h2>
              <p className="text-pretty text-sm leading-6 text-[var(--zt-muted)]">
                固定された時間座標に event を置く基本画面です。annotation が何もなくても、
                event 自体はここに残ります。
              </p>
            </div>

            <div className="mt-5 rounded-[28px] border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] p-3 sm:p-4">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--zt-outline)] pb-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--zt-foreground)]">{bundle.selectedDate}</p>
                  <p className="text-sm text-[var(--zt-muted)]">event が密集する時間と空白時間を同じ座標系で見る。</p>
                </div>
                <EventChip label={`${laneCount} lane`} />
              </div>

              <div className="mt-4 overflow-x-auto">
                <div
                  className="grid min-w-[780px] grid-cols-[72px_minmax(0,1fr)]"
                  style={{ height: `${TIMELINE_ROW_HEIGHT * 24}px` }}
                >
                  <div className="relative">
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="absolute left-0 right-0 border-t border-dashed border-[var(--zt-outline)]"
                        style={{ top: `${(hour / 24) * 100}%` }}
                      >
                        <span className="absolute -top-3 left-0 rounded-full bg-[var(--zt-surface)] px-2 py-0.5 font-mono text-xs text-[var(--zt-muted)]">
                          {hourLabel(hour)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="relative rounded-[24px] border border-[var(--zt-outline)] bg-white">
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="absolute left-0 right-0 border-t border-dashed border-[var(--zt-outline)]"
                        style={{ top: `${(hour / 24) * 100}%` }}
                      />
                    ))}

                    {events.map((event) => (
                      <article
                        key={event.id}
                        className="absolute overflow-hidden rounded-[24px] border border-[var(--zt-primary-soft)] bg-[var(--zt-primary-pale)] px-3 py-3 shadow-sm"
                        style={blockStyle(event, laneCount)}
                      >
                        <div className="space-y-2">
                          <div>
                            <p className="font-mono text-xs text-[var(--zt-primary)]">{event.timeLabel}</p>
                            <h3 className="mt-1 text-balance text-sm font-semibold text-[var(--zt-foreground)]">
                              {event.title}
                            </h3>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <EventChip label={`${event.tasks.length} task`} tone="task" />
                            <EventChip label={`${event.knowledge.length} knowledge`} tone="knowledge" />
                            <EventChip label={`${event.decisions.length} decision`} tone="decision" />
                          </div>
                          {event.threads[0] ? (
                            <p className="line-clamp-3 text-pretty text-xs leading-5 text-[var(--zt-muted-strong)]">
                              {event.threads[0].summary ?? event.threads[0].title}
                            </p>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-[var(--zt-outline)] bg-[var(--zt-surface)] p-5 shadow-sm sm:p-6">
            <div className="space-y-1">
              <p className="text-xs font-medium text-[var(--zt-muted)]">Annotation Layer</p>
              <h2 className="text-balance text-xl font-semibold">Event Catalog</h2>
              <p className="text-pretty text-sm leading-6 text-[var(--zt-muted)]">
                各 event に task や knowledge がどの程度乗っているかを横で確認します。
              </p>
            </div>

            <div className="mt-5 space-y-3">
              {events.map((event) => (
                <article
                  key={event.id}
                  className="rounded-[24px] border border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-mono text-xs text-[var(--zt-primary)]">{event.timeLabel}</p>
                      <h3 className="text-balance text-base font-semibold">{event.title}</h3>
                    </div>
                    <EventChip label={event.id} />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <EventChip label={`${event.threads.length} thread`} />
                    <EventChip label={`${event.tasks.length} task`} tone="task" />
                    <EventChip label={`${event.decisions.length} decision`} tone="decision" />
                    <EventChip label={`${event.knowledge.length} knowledge`} tone="knowledge" />
                  </div>

                  <div className="mt-4 space-y-3">
                    <AnnotationList title="Threads" rows={event.threads} />
                    <AnnotationList title="Tasks" rows={event.tasks} />
                    <AnnotationList title="Knowledge" rows={event.knowledge} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function AnnotationList({
  title,
  rows,
}: {
  title: string;
  rows: Array<{
    key: string;
    title: string;
    summary?: string;
    priority?: string;
    category?: string;
  }>;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-[var(--zt-muted)]">{title}</p>
      {rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--zt-outline)] px-3 py-2 text-sm text-[var(--zt-muted)]">
          (none)
        </p>
      ) : (
        rows.slice(0, 3).map((row) => (
          <div key={row.key} className="rounded-2xl border border-[var(--zt-outline)] bg-white px-3 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-[var(--zt-foreground)]">{row.title}</p>
              {row.priority ? <EventChip label={row.priority} tone="task" /> : null}
              {row.category ? <EventChip label={row.category} tone="knowledge" /> : null}
            </div>
            {row.summary ? (
              <p className="mt-2 text-pretty text-sm leading-6 text-[var(--zt-muted)]">{row.summary}</p>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
