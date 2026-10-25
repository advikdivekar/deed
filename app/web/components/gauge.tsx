import { CLOSE_RATIO, fmtRatio, fmtRatioShort } from "@/lib/survey";

/** Closure ratio on a log scale from 1:10 to 1:100,000. The tick is the pass threshold. */
export function Gauge({ ratio }: { ratio: number }) {
  const lo = 1, hi = 5, v = ratio === Infinity ? hi : Math.min(hi, Math.max(lo, Math.log10(ratio)));
  const f = (v - lo) / (hi - lo), ok = ratio >= CLOSE_RATIO;
  const R = 52, C = Math.PI * R, tf = (Math.log10(CLOSE_RATIO) - lo) / (hi - lo), ta = Math.PI * (1 - tf);
  return (
    <svg viewBox="0 0 140 84" className="w-full max-w-[220px]" role="img" aria-label={`Closure ratio ${fmtRatio(ratio)}`}>
      <path d="M18 70 A52 52 0 0 1 122 70" fill="none" stroke="var(--border-strong)" strokeWidth="9" strokeLinecap="round" />
      <path d="M18 70 A52 52 0 0 1 122 70" fill="none" stroke={ok ? "var(--ok)" : "var(--terra)"} strokeWidth="9" strokeLinecap="round" strokeDasharray={C} style={{ ["--from" as string]: C, ["--to" as string]: C * (1 - f), animation: "ring 1.1s cubic-bezier(.3,0,.1,1) .2s both" }} />
      <line x1={70 + 44 * Math.cos(ta)} y1={70 - 44 * Math.sin(ta)} x2={70 + 61 * Math.cos(ta)} y2={70 - 61 * Math.sin(ta)} stroke="var(--foreground)" strokeWidth="1.6" />
      <text x="70" y="62" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--foreground)" className="font-mono">{fmtRatioShort(ratio)}</text>
      <text x="70" y="78" textAnchor="middle" fontSize="7.5" fill="var(--muted)" className="font-mono">PASS ≥ 1:{CLOSE_RATIO.toLocaleString("en-US")}</text>
    </svg>
  );
}
