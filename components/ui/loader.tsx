import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export function Loader({ className, text }: { className?: string; text?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <Loader2 className="h-4 w-4 animate-spin" />
      {text ? <span>{text}</span> : null}
    </div>
  );
}
