import { promises as fs } from "node:fs";
import path from "node:path";

const DEFAULT_DAILY_ROLLUPS_ROOT = path.resolve(
  /* turbopackIgnore: true */ process.cwd(),
  "../android-zero-touch/experiments/amical/artifacts/daily-rollups",
);

function resolveDailyRollupsRoot() {
  return process.env.ZEROTOUCH_STATEFUL_ARTIFACTS_ROOT ?? DEFAULT_DAILY_ROLLUPS_ROOT;
}

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const text = await fs.readFile(filePath, "utf-8");
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export type DailyThread = {
  thread_id?: string;
  title: string;
  summary: string;
  source_spot_ids?: string[];
};

export type DailyDecision = {
  summary: string;
  source_refs?: string[];
  source_spot_ids?: string[];
};

export type DailyTask = {
  task_id?: string;
  task_key?: string;
  title: string;
  summary: string;
  priority?: string;
  status?: string;
  source_refs?: string[];
};

export type DailyKnowledge = {
  knowledge_id?: string;
  knowledge_key?: string;
  title: string;
  summary: string;
  category: string;
  status?: string;
  source_refs?: string[];
};

export type DailyRollup = {
  date: string;
  headline: string;
  abstract: string;
  status_summary: string;
  main_threads?: DailyThread[];
  decisions?: DailyDecision[];
  open_tasks?: DailyTask[];
  knowledge_refs?: DailyKnowledge[];
};

export type ContextBundle = {
  bundle_date: string;
  recent_chronology_summary: string;
  recent_daily_context?: Array<{
    date: string;
    headline: string;
    abstract: string;
    status_summary: string;
  }>;
  active_task_refs?: string[];
  active_decision_refs?: string[];
  active_knowledge_refs?: string[];
  priority_items?: string[];
};

export type ActiveStateSnapshot = {
  date: string;
  generated_at: string;
  active_tasks?: Array<DailyTask & { first_seen_at?: string; last_seen_at?: string; task_kind?: string }>;
  decision_log?: Array<{
    decision_id?: string;
    decision_key?: string;
    statement: string;
    status?: string;
    last_confirmed_at?: string;
    source_refs?: string[];
  }>;
  durable_knowledge?: Array<DailyKnowledge & { last_confirmed_at?: string }>;
};

export type StateDelta = {
  date: string;
  task_mutations?: Array<{
    mutation: string;
    task_id?: string;
    title?: string;
    reason?: string;
    source_refs?: string[];
  }>;
  decision_mutations?: Array<{
    mutation: string;
    decision_id?: string;
    statement?: string;
    reason?: string;
    source_refs?: string[];
  }>;
  knowledge_mutations?: Array<{
    mutation: string;
    knowledge_id?: string;
    title?: string;
    category?: string;
    reason?: string;
    source_refs?: string[];
  }>;
};

export type StatefulDailyRollup = {
  date: string;
  headline: string;
  abstract: string;
  status_summary: string;
  main_threads?: DailyThread[];
  continuing_priorities?: string[];
  carried_over_tasks?: DailyTask[];
  newly_opened_tasks?: DailyTask[];
  decisions_today?: Array<
    | DailyDecision
    | {
        statement: string;
        source_refs?: string[];
      }
  >;
  updated_knowledge?: DailyKnowledge[];
  planner_model?: string | null;
};

export type StatefulArtifactsBundle = {
  availableDates: string[];
  selectedDate: string | null;
  baseDaily: DailyRollup | null;
  contextBundle: ContextBundle | null;
  statefulDaily: StatefulDailyRollup | null;
  stateDelta: StateDelta | null;
  activeStateSnapshot: ActiveStateSnapshot | null;
};

export async function listAvailableDailyDates() {
  try {
    const entries = await fs.readdir(resolveDailyRollupsRoot(), { withFileTypes: true });
    const dates = await Promise.all(
      entries
        .filter((entry) => entry.isDirectory())
        .map(async (entry) => {
          const baseRollupPath = path.join(resolveDailyRollupsRoot(), entry.name, "08_daily_rollup.json");
          try {
            await fs.access(baseRollupPath);
            return entry.name;
          } catch {
            return null;
          }
        }),
    );

    return dates.filter((value): value is string => Boolean(value)).sort();
  } catch {
    return [];
  }
}

export async function loadStatefulArtifacts(date?: string | null): Promise<StatefulArtifactsBundle> {
  const availableDates = await listAvailableDailyDates();
  const selectedDate =
    date && availableDates.includes(date) ? date : availableDates[availableDates.length - 1] ?? null;

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

  const baseDir = path.join(resolveDailyRollupsRoot(), selectedDate);

  const [baseDaily, contextBundle, statefulDaily, stateDelta, activeStateSnapshot] = await Promise.all([
    readJsonFile<DailyRollup>(path.join(baseDir, "08_daily_rollup.json")),
    readJsonFile<ContextBundle>(path.join(baseDir, "09_context_bundle.json")),
    readJsonFile<StatefulDailyRollup>(path.join(baseDir, "10_stateful_daily_rollup.json")),
    readJsonFile<StateDelta>(path.join(baseDir, "11_state_delta.json")),
    readJsonFile<ActiveStateSnapshot>(path.join(baseDir, "12_active_state_snapshot.json")),
  ]);

  return {
    availableDates,
    selectedDate,
    baseDaily,
    contextBundle,
    statefulDaily,
    stateDelta,
    activeStateSnapshot,
  };
}
