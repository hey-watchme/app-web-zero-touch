import type {
  DailyDecision,
  DailyKnowledge,
  DailyTask,
  DailyThread,
  DailySourceSpot,
  StatefulArtifactsBundle,
} from "@/lib/stateful-artifacts";

type DailyDecisionLike = DailyDecision | { statement: string; source_refs?: string[] };

export type StatefulEventAnnotation = {
  key: string;
  kind: "thread" | "task" | "decision" | "knowledge";
  title: string;
  summary?: string;
  priority?: string;
  category?: string;
};

export type StatefulEvent = {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  startMinute: number;
  endMinute: number;
  timeLabel: string;
  lane: number;
  threads: StatefulEventAnnotation[];
  tasks: StatefulEventAnnotation[];
  decisions: StatefulEventAnnotation[];
  knowledge: StatefulEventAnnotation[];
};

type LaneCandidate = StatefulEvent & { lane: number };

function parseSpotIds(
  sourceSpotIds?: string[] | null,
  sourceRefs?: string[] | null,
): string[] {
  const values = new Set<string>();

  for (const value of sourceSpotIds ?? []) {
    const normalized = value?.trim();
    if (normalized) {
      values.add(normalized);
    }
  }

  for (const ref of sourceRefs ?? []) {
    const normalized = ref?.trim();
    if (!normalized) {
      continue;
    }
    const match = normalized.match(/^(SPOT-[^:]+)/);
    if (match?.[1]) {
      values.add(match[1]);
    }
  }

  return [...values];
}

function extractMinute(isoValue: string, fallbackMinute: number): number {
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) {
    return fallbackMinute;
  }
  return date.getHours() * 60 + date.getMinutes();
}

function formatTimeLabel(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "時刻不明";
  }

  const formatter = new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `${formatter.format(start)} - ${formatter.format(end)}`;
}

function normalizeRange(spot: DailySourceSpot) {
  const startMinute = extractMinute(spot.start_at ?? "", 0);
  const rawEndMinute = extractMinute(spot.end_at ?? "", startMinute + 45);
  const clampedStart = Math.max(0, Math.min(1439, startMinute));
  const clampedEnd = Math.max(clampedStart + 30, Math.min(1440, rawEndMinute));

  return {
    startMinute: clampedStart,
    endMinute: clampedEnd,
  };
}

function mapThread(thread: DailyThread): StatefulEventAnnotation {
  return {
    key: thread.thread_id ?? thread.title,
    kind: "thread",
    title: thread.title,
    summary: thread.summary,
  };
}

function mapTask(task: DailyTask): StatefulEventAnnotation {
  return {
    key: task.task_id ?? task.task_key ?? task.title,
    kind: "task",
    title: task.title,
    summary: task.summary,
    priority: task.priority,
  };
}

function mapDecision(decision: DailyDecision): StatefulEventAnnotation {
  return {
    key: decision.summary,
    kind: "decision",
    title: decision.summary,
  };
}

function mapDecisionLike(decision: DailyDecisionLike): StatefulEventAnnotation {
  if ("summary" in decision) {
    return mapDecision(decision);
  }

  return {
    key: decision.statement,
    kind: "decision",
    title: decision.statement,
  };
}

function mapKnowledge(knowledge: DailyKnowledge): StatefulEventAnnotation {
  return {
    key: knowledge.knowledge_id ?? knowledge.knowledge_key ?? knowledge.title,
    kind: "knowledge",
    title: knowledge.title,
    summary: knowledge.summary,
    category: knowledge.category,
  };
}

function filterBySpot<T>(
  rows: T[],
  spotId: string,
  getter: (row: T) => { source_spot_ids?: string[] | null; source_refs?: string[] | null },
): T[] {
  return rows.filter((row) => {
    const meta = getter(row);
    return parseSpotIds(meta.source_spot_ids, meta.source_refs).includes(spotId);
  });
}

function assignLanes(events: Array<Omit<StatefulEvent, "lane">>): StatefulEvent[] {
  const laneEnds: number[] = [];

  return events.map((event) => {
    let laneIndex = laneEnds.findIndex((laneEnd) => event.startMinute >= laneEnd);

    if (laneIndex === -1) {
      laneIndex = laneEnds.length;
      laneEnds.push(event.endMinute);
    } else {
      laneEnds[laneIndex] = event.endMinute;
    }

    const candidate: LaneCandidate = {
      ...event,
      lane: laneIndex,
    };

    return candidate;
  });
}

export function buildStatefulEvents(bundle: StatefulArtifactsBundle): StatefulEvent[] {
  const statefulDaily = bundle.statefulDaily;
  if (!statefulDaily?.source_spots?.length) {
    return [];
  }

  const threads = statefulDaily.main_threads ?? [];
  const carriedOverTasks = statefulDaily.carried_over_tasks ?? [];
  const newlyOpenedTasks = statefulDaily.newly_opened_tasks ?? [];
  const decisionsToday = (statefulDaily.decisions_today ?? []) as DailyDecisionLike[];
  const updatedKnowledge = statefulDaily.updated_knowledge ?? [];

  const sortedSpots = [...statefulDaily.source_spots].sort((left, right) => {
    const leftMinute = normalizeRange(left).startMinute;
    const rightMinute = normalizeRange(right).startMinute;
    return leftMinute - rightMinute;
  });

  const events = sortedSpots.map((spot) => {
    const range = normalizeRange(spot);
    const spotThreads = filterBySpot(
      threads,
      spot.spot_id,
      (row) => ({ source_spot_ids: row.source_spot_ids }),
    ).map(mapThread);
    const spotTasks = [
      ...filterBySpot(carriedOverTasks, spot.spot_id, (row) => ({
        source_spot_ids: (row as DailyTask & { source_spot_ids?: string[] }).source_spot_ids,
        source_refs: row.source_refs,
      })),
      ...filterBySpot(newlyOpenedTasks, spot.spot_id, (row) => ({
        source_spot_ids: (row as DailyTask & { source_spot_ids?: string[] }).source_spot_ids,
        source_refs: row.source_refs,
      })),
    ].map(mapTask);
    const spotDecisions = filterBySpot(decisionsToday, spot.spot_id, (row) => ({
      source_spot_ids: "source_spot_ids" in row ? row.source_spot_ids : undefined,
      source_refs: row.source_refs,
    })).map(mapDecisionLike);
    const spotKnowledge = filterBySpot(updatedKnowledge, spot.spot_id, (row) => ({
      source_refs: row.source_refs,
    })).map(mapKnowledge);

    return {
      id: spot.spot_id,
      title: spot.headline ?? spot.spot_id,
      startAt: spot.start_at ?? "",
      endAt: spot.end_at ?? "",
      startMinute: range.startMinute,
      endMinute: range.endMinute,
      timeLabel: formatTimeLabel(spot.start_at ?? "", spot.end_at ?? ""),
      threads: spotThreads,
      tasks: spotTasks,
      decisions: spotDecisions,
      knowledge: spotKnowledge,
    };
  });

  return assignLanes(events);
}

export function maxTimelineLane(events: StatefulEvent[]): number {
  return events.reduce((max, event) => Math.max(max, event.lane), 0) + 1;
}
