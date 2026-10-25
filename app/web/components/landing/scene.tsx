import { closure, fmtBearing } from "@/lib/survey";
import { SAMPLES } from "@/lib/samples";

const W = 1440, H = 900;

/** Survey-map landscape: layered contour lines, a pale moon, and a parcel that draws itself leg by leg. */
export function HeroScene() {
  const calls = SAMPLES[0].deed.calls;
  const r = closure(calls);
  const pts = r.points.slice(0, -1);
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const minX = Math.min(...xs), maxY = Math.max(...ys);
  const k = 2.0; // px per foot
  const ox = W * 0.76 - ((Math.max(...xs) - minX) * k) / 2, oy = H * 0.2;
  const P = pts.map((p) => ({ x: ox + (p.x - minX) * k, y: oy + (maxY - p.y) * k }));
  const path = P.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ") + " Z";
  const contours = Array.from({ length: 15 }, (_, i) => {
    const base = 120 + i * 52, amp = 26 + (i % 4) * 12, ph = i * 0.9;
    let d = `M-20 ${base}`;
    for (let x = 0; x <= W + 40; x += 60) d += ` L${x} ${(base + Math.sin(x / 190 + ph) * amp + Math.sin(x / 71 + ph * 2) * (amp / 3)).toFixed(1)}`;
    return d;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#003135" /><stop offset=".55" stopColor="#0b6b75" /><stop offset="1" stopColor="#0a8f9a" /></linearGradient>
        <radialGradient id="moon" cx=".5" cy=".5" r=".5"><stop offset="0" stopColor="#d9f3f5" stopOpacity=".55" /><stop offset="1" stopColor="#6FD6DE" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width={W} height={H} fill="url(#sky)" />
      <circle cx="470" cy="190" r="190" fill="url(#moon)" /><circle cx="470" cy="190" r="20" fill="#cfe9ec" opacity=".85" />
      {contours.map((d, i) => <path key={i} d={d} fill="none" stroke="#AFDDE5" strokeOpacity={0.05 + (i % 3) * 0.035} strokeWidth="1.2" />)}
      <path d={path} fill="#0FA4AF" fillOpacity=".12" className="late" style={{ ["--d" as string]: "2.6s" }} />
      <path d={path} fill="none" stroke="#6FD6DE" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" className="draw" style={{ ["--len" as string]: 2400 }} />
      {P.map((p, i) => (
        <g key={i} className="late" style={{ ["--d" as string]: `${0.5 + i * 0.5}s` }}>
          <circle cx={p.x} cy={p.y} r={i === 0 ? 9 : 5.5} fill={i === 0 ? "#0FA4AF" : "#003135"} stroke="#6FD6DE" strokeWidth="2" />
          <text x={p.x + (p.x > W * 0.8 ? -14 : 14)} y={p.y - 12} textAnchor={p.x > W * 0.8 ? "end" : "start"} fill="#d9f3f5" fontSize="13" fontFamily="var(--font-geist-mono), monospace" letterSpacing="1">{i === 0 ? "POB" : `${fmtBearing(calls[i - 1])}  ${calls[i - 1].dist}′`}</text>
        </g>
      ))}
      <text x={ox} y={oy + (maxY - Math.min(...ys)) * k + 56} fill="#AFDDE5" fontSize="13" fontFamily="var(--font-geist-mono), monospace" letterSpacing="2" className="late" style={{ ["--d" as string]: "3s" }}>CLOSES · 1:{Math.round(r.ratio).toLocaleString("en-US")}</text>
    </svg>
  );
}
