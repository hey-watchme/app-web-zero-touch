import { StatefulTaskTimelineViewer } from "@/components/stateful-task-timeline-viewer";
import { loadStatefulArtifacts } from "@/lib/stateful-artifacts";

type PageProps = {
  searchParams?: Promise<{
    date?: string;
  }>;
};

export default async function StatefulTasksPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const bundle = await loadStatefulArtifacts(resolvedSearchParams.date);

  return <StatefulTaskTimelineViewer bundle={bundle} />;
}
