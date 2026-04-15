import { StatefulKnowledgeViewer } from "@/components/stateful-knowledge-viewer";
import { loadStatefulArtifacts } from "@/lib/stateful-artifacts";

type PageProps = {
  searchParams?: Promise<{
    date?: string;
  }>;
};

export default async function StatefulKnowledgePage({ searchParams }: PageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const bundle = await loadStatefulArtifacts(resolvedSearchParams.date);

  return <StatefulKnowledgeViewer bundle={bundle} />;
}
