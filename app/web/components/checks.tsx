import { Check as Tick, X } from "lucide-react";
import type { Check } from "@/lib/types";
import { Card, cx, SectionTitle } from "./ui";

export function ChecksCard({ checks }: { checks: Check[] }) {
  return (
    <Card>
      <SectionTitle hint="Run in plain code on every output. One failure means a human looks.">Safety checks</SectionTitle>
      <ul className="space-y-2.5">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-3">
            <span className={cx("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", c.ok ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn")}>{c.ok ? <Tick className="size-3" aria-hidden /> : <X className="size-3" aria-hidden />}</span>
            <div className="min-w-0 text-sm"><p className={cx("font-medium", !c.ok && "text-warn")}>{c.label}</p>
              {c.detail.slice(0, 4).map((d) => <p key={d} className="font-mono text-xs text-muted">{d}</p>)}
              {c.detail.length > 4 && <p className="font-mono text-xs text-muted">+{c.detail.length - 4} more</p>}</div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
