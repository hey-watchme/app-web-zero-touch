import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase-server";

const FALLBACK_DEVICE_ID = "amical-db-test";

type WikiRow = {
  id: string;
  title: string;
  body: string;
  project_id: string | null;
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

type ProjectRow = {
  id: string;
  project_key: string;
  display_name: string;
};

type WikiPageRecord = WikiRow & {
  project_key: string | null;
  project_name: string | null;
};

type FactRow = {
  id: string;
  topic_id: string;
  fact_text: string;
  importance_level: number | null;
  categories: string[] | null;
  ttl_type: string | null;
  created_at: string;
};

function resolveDeviceId(request: NextRequest) {
  return (
    request.nextUrl.searchParams.get("device_id") ??
    process.env.ZEROTOUCH_DEVICE_ID ??
    FALLBACK_DEVICE_ID
  );
}

async function enrichWikiPagesWithProjects(
  supabase: ReturnType<typeof createSupabaseServer>,
  wikiRows: WikiRow[],
) {
  const projectIds = [...new Set(wikiRows.map((row) => row.project_id).filter(Boolean))] as string[];
  const projectsById = new Map<string, ProjectRow>();

  if (projectIds.length > 0) {
    const { data: projectRows, error: projectError } = await supabase
      .from("zerotouch_workspace_projects")
      .select("id, project_key, display_name")
      .in("id", projectIds);

    if (projectError) {
      return { error: projectError.message, pages: [] as WikiPageRecord[] };
    }

    ((projectRows ?? []) as ProjectRow[]).forEach((project) => {
      projectsById.set(project.id, project);
    });
  }

  const pages = wikiRows.map((row) => {
    const project = row.project_id ? projectsById.get(row.project_id) : undefined;

    return {
      ...row,
      project_key: project?.project_key ?? null,
      project_name: project?.display_name ?? null,
    };
  });

  return { error: null, pages };
}

export async function GET(request: NextRequest) {
  const supabase = createSupabaseServer();
  const deviceId = resolveDeviceId(request);

  const { data: wikiRows, error: wikiError } = await supabase
    .from("zerotouch_wiki_pages")
    .select(
      "id, title, body, project_id, category, page_key, kind, status, version, source_fact_ids, last_ingest_at, created_at, updated_at",
    )
    .eq("device_id", deviceId)
    .order("updated_at", { ascending: false });

  if (wikiError) {
    if (wikiError.code === "42P01") {
      return NextResponse.json({ deviceId, pages: [], facts: [], wikiAvailable: false });
    }
    return NextResponse.json({ error: wikiError.message }, { status: 500 });
  }

  const {
    error: projectError,
    pages,
  } = await enrichWikiPagesWithProjects(supabase, (wikiRows ?? []) as WikiRow[]);

  if (projectError) {
    return NextResponse.json({ error: projectError }, { status: 500 });
  }

  const referencedFactIds = new Set<string>();
  pages.forEach((page) => {
    (page.source_fact_ids ?? []).forEach((id) => {
      if (id) referencedFactIds.add(id);
    });
  });

  let facts: FactRow[] = [];
  if (referencedFactIds.size > 0) {
    const idList = [...referencedFactIds];
    const chunkSize = 200;
    for (let index = 0; index < idList.length; index += chunkSize) {
      const chunk = idList.slice(index, index + chunkSize);
      const { data: factRows, error: factError } = await supabase
        .from("zerotouch_facts")
        .select("id, topic_id, fact_text, importance_level, categories, ttl_type, created_at")
        .in("id", chunk);
      if (factError) {
        return NextResponse.json({ error: factError.message }, { status: 500 });
      }
      facts = facts.concat((factRows ?? []) as FactRow[]);
    }
  }

  return NextResponse.json({
    deviceId,
    pages,
    facts,
    wikiAvailable: true,
  });
}
