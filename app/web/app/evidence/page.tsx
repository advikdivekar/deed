import { AppShell } from "@/components/app-shell";
import { Badge, Card, SectionTitle } from "@/components/ui";

export const metadata = { title: "Evidence · DeedReader" };

const ROWS: [string, string, string, string][] = [
  ["Read exactly right", "10% (6 of 60)", "99.6% (2,988 of 3,000)", "Every field of every call matches the answer key."],
  ["Sent to a human", "82%", "0.4%", "Any safety check failing. A flagged answer is not a failure."],
  ["Wrong and not flagged", "5 of 60", "2 of 3,000", "Both are one deed written two ways (87 links = 0.87 chain). Zero by physical length."],
  ["Spelled-out numbers, fresh deeds", "16.7% (60)", "99.6% (250)", "After 150 examples of the style."],
  ["Texas varas, fresh deeds", "10.0% (60)", "100% (250)", "After 150 examples of the unit."],
];
const COST: [string, string][] = [["Baseline, no training", "$0.11"], ["Learning-curve runs (250 / 500 / 1,000)", "$0.29"], ["First full run (2,000 deeds)", "$1.01"], ["Final model (2,300 deeds, 3 epochs)", "$1.15"], ["All evaluation", "$1.35"], ["Everything on Tinker", "about $3.80"]];

export default function Page() {
  return (
    <AppShell>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <p className="eyebrow mb-2">Evidence</p>
        <h1 className="text-[28px] font-light leading-tight sm:text-4xl">One dollar fifteen, <span className="text-accent-text">measured.</span></h1>
        <p className="mt-3 max-w-xl text-muted">Same base model (Qwen3-8B), same prompt, same safety checks. The only change is the fine-tune on Tinker. Scored on deeds generated with known answers; every number is computed from saved model outputs in <code className="font-mono text-[13px]">EVAL_REPORT.md</code>.</p>

        <Card className="mt-8">
          <SectionTitle hint="The number that matters is “wrong and not flagged”.">Before and after the fine-tune</SectionTitle>
          <div className="overflow-x-auto"><table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="eyebrow"><tr><th className="py-2 font-normal">Metric</th><th className="py-2 font-normal">Untrained</th><th className="py-2 font-normal">Fine-tuned</th></tr></thead>
            <tbody>{ROWS.map(([m, a, b, h]) => (
              <tr key={m} className="border-t border-border align-top"><td className="py-3 pr-4"><p className="font-medium">{m}</p><p className="text-xs text-muted">{h}</p></td><td className="py-3 pr-4 font-mono text-[13px]">{a}</td><td className="py-3"><Badge tone="ok">{b}</Badge></td></tr>
            ))}</tbody>
          </table></div>
        </Card>

        <Card className="mt-6">
          <SectionTitle hint="One epoch each, same 500 held-out deeds. Seventeen cents buys 99.4%.">Accuracy per dollar</SectionTitle>
          <img src="/charts/learning_curve.png" alt="Learning curve: exact-read rate against training cost" className="w-full rounded-lg" />
        </Card>

        <Card className="mt-6">
          <SectionTitle hint="Fresh 3,000-deed set, validator frozen before it was run.">Where every deed ends up</SectionTitle>
          <img src="/charts/where_deeds_end_up.png" alt="3,000 deeds: 2,988 exactly right, 10 wrong and caught, 2 wrong and unflagged" className="w-full rounded-lg" />
        </Card>

        <Card className="mt-6">
          <SectionTitle hint="Estimated from token counts at Tinker list prices.">The whole bill</SectionTitle>
          <table className="w-full text-left text-sm"><tbody>{COST.map(([k, v]) => <tr key={k} className="border-t border-border"><td className="py-2.5 pr-4">{k}</td><td className="py-2.5 text-right font-mono text-[13px]">{v}</td></tr>)}</tbody></table>
          <p className="mt-4 text-sm text-muted">Offline, the 369 MB adapter on a 4-bit base read 150 of 150 deeds exactly right on a laptop GPU, median 7.5 s per deed, no network.</p>
        </Card>
      </main>
    </AppShell>
  );
}
