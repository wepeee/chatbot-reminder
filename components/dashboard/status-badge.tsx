import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) {
    return <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">-</span>;
  }

  const map: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    completed: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-zinc-200 text-zinc-700",
    overdue: "bg-rose-100 text-rose-800",
    sent: "bg-emerald-100 text-emerald-800",
    failed: "bg-rose-100 text-rose-800"
  };

  return (
    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", map[status] ?? "bg-secondary text-secondary-foreground")}>
      {status}
    </span>
  );
}
