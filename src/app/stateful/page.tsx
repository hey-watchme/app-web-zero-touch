import { StatefulDailyViewer } from "@/components/stateful-daily-viewer";
import { loadStatefulArtifacts } from "@/lib/stateful-artifacts";

type PageProps = {
  searchParams?: Promise<{
    date?: string;
  }>;
};

export default async function StatefulPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const bundle = await loadStatefulArtifacts(resolvedSearchParams.date);

  return <StatefulDailyViewer bundle={bundle} />;
}
