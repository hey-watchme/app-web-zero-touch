import { StatefulDailyViewer } from "@/components/stateful-daily-viewer";
import { loadStatefulArtifactsFromDB } from "@/lib/db-artifacts";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<{
    date?: string;
    device?: string;
  }>;
};

export default async function StatefulPage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const bundle = await loadStatefulArtifactsFromDB(
    resolvedSearchParams.date,
    resolvedSearchParams.device,
  );

  return <StatefulDailyViewer bundle={bundle} />;
}
