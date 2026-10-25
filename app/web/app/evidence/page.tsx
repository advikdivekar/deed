import { AppShell } from "@/components/app-shell";
import { Badge, Card, SectionTitle } from "@/components/ui";

export const metadata = { title: "Evidence · DeedReader" };

const METRICS = [
  ["Field-level exact match, in-distribution styles", "≥ 99.9%", "Per field: bearing, distance, unit, reference."],
  ["Field-level exact match, held-out styles and unit system", "reported as measured", "Expected to be lower. This is the honest generalization number."],
  ["Silent-error rate", "≤ 0.1%", "Output is wrong AND not flagged. Flagged-but-wrong does not count."],
  ["Flag rate", "reported as measured", "How often a human is still needed. Shown as a threshold tradeoff curve."],
] as const;

export default function Page() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <p className="eyebrow mb-2">Evidence</p>
        <h1 className="text-[28px] font-light leading-tight sm:text-4xl">What we claim, <span className="text-accent-text">and what we have measured.</span></h1>
        <p className="mt-3 max-w-xl text-muted">Nothing on this page is a result yet. Targets are goals; the “measured” column fills in from <code className="font-mono text-[13px]">EVAL_REPORT.md</code> after the held-out evaluation runs.</p>
        <Card className="mt-8">
          <SectionTitle hint="Each metric is reported separately so a good one cannot hide a bad one.">Metrics</SectionTitle>
          <div className="overflow-x-auto"><table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="eyebrow"><tr><th className="py-2 font-normal">Metric</th><th className="py-2 font-normal">Target</th><th className="py-2 font-normal">Base model</th><th className="py-2 font-normal">Tuned</th></tr></thead>
            <tbody>{METRICS.map(([m, t, h]) => (
              <tr key={m} className="border-t border-border align-top"><td className="py-3 pr-4"><p className="font-medium">{m}</p><p className="text-xs text-muted">{h}</p></td><td className="py-3 pr-4 font-mono text-[13px]">{t}</td><td className="py-3 pr-4"><Badge>not run</Badge></td><td className="py-3"><Badge>not run</Badge></td></tr>
            ))}</tbody>
          </table></div>
        </Card>
      </main>
    </AppShell>
  );
}
