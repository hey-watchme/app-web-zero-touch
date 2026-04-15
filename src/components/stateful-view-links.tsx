import Link from "next/link";
import { cn } from "@/lib/cn";

type StatefulViewLinksProps = {
  active: "overview" | "timeline" | "tasks" | "knowledge";
  date?: string | null;
};

const LINKS = [
  { key: "overview", label: "All-in-one", href: "/stateful" },
  { key: "timeline", label: "Timeline", href: "/stateful/timeline" },
  { key: "tasks", label: "Tasks", href: "/stateful/tasks" },
  { key: "knowledge", label: "Knowledge", href: "/stateful/knowledge" },
] as const;

function withDate(href: string, date?: string | null) {
  if (!date) {
    return href;
  }
  return `${href}?date=${date}`;
}

export function StatefulViewLinks({ active, date }: StatefulViewLinksProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {LINKS.map((link) => {
        const isActive = link.key === active;
        return (
          <Link
            key={link.key}
            href={withDate(link.href, date)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium",
              isActive
                ? "border-[var(--zt-primary-soft)] bg-[var(--zt-primary-pale)] text-[var(--zt-primary)]"
                : "border-[var(--zt-outline)] bg-[var(--zt-surface-soft)] text-[var(--zt-muted-strong)] hover:bg-[var(--zt-surface-strong)]",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
