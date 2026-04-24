import { Suspense } from "react";
import { WikiExplorer } from "@/components/wiki-explorer";

export default function WikiPage() {
  return (
    <Suspense>
      <WikiExplorer />
    </Suspense>
  );
}
