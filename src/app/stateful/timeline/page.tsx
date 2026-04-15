import { StatefulEventTimeline } from "@/components/stateful-event-timeline";
import { loadStatefulArtifacts } from "@/lib/stateful-artifacts";

type PageProps = {
  searchParams?: Promise<{
    date?: string;
  }>;
};

export default async function StatefulTimelinePage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const bundle = await loadStatefulArtifacts(resolvedSearchParams.date);

  return <StatefulEventTimeline bundle={bundle} />;
}
