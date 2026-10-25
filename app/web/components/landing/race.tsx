"use client";
import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** By-hand vs DeedReader. The hand clock runs ~400x faster than real time; the point is the ratio, and the label says so. */
export function Race() {
  const ref = useRef<HTMLDivElement>(null);
  const [t, setT] = useState(0); // 0..1 progress of the by-hand plot
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setStarted(true); io.disconnect(); } }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!started) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { setT(1); return; }
    const t0 = performance.now(); let raf = 0;
    const tick = (n: number) => { const p = Math.min(1, (n - t0) / 4200); setT(p); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started]);
  const mins = 22 * t, clock = `${String(Math.floor(mins)).padStart(2, "0")}:${String(Math.floor((mins % 1) * 60)).padStart(2, "0")}`;
  const steps = ["Read the deed", "Convert bearings", "Protractor and scale", "Draw 7 legs", "Check the closure", "Compute the area"];
  return (
    <div ref={ref} className="grid gap-4 md:grid-cols-2">
      <div className="panel-l p-6">
        <p className="label muted">By hand</p>
        <p className="mono mt-3 text-5xl font-light tracking-tight">{clock}</p>
        <ul className="mt-5 space-y-2 text-[15px]">
          {steps.map((s, i) => { const done = t > (i + 1) / steps.length; return <li key={s} className={`flex items-center gap-2 transition-opacity ${done ? "opacity-100" : "opacity-45"}`}><span className={`grid size-4 place-items-center rounded-full text-[10px] ${done ? "bg-[#037A84] text-white" : "ring-1 ring-current"}`}>{done && <Check className="size-2.5" aria-hidden />}</span>{s}</li>; })}
        </ul>
        <p className="muted mt-5 text-xs">Typical 15–30 minutes per deed (the clock above is sped up).</p>
      </div>
      <div className="panel p-6">
        <p className="label tick">DeedReader</p>
        <p className="mono mt-3 text-5xl font-light tracking-tight text-[var(--turq-soft)]">{started ? "seconds" : "···"}</p>
        <ul className="mt-5 space-y-2 text-[15px]">
          {["Paste the deed", "Read the calls", "Closure and area, in code", "Glance at the drawing", "Approve"].map((s) => <li key={s} className="flex items-center gap-2"><span className="grid size-4 place-items-center rounded-full bg-[var(--turq)] text-[10px] text-[var(--turq-ink)]"><Check className="size-2.5" aria-hidden /></span>{s}</li>)}
        </ul>
        <p className="muted mt-5 text-xs">Your only job is the glance. If anything is off, it tells you which call.</p>
      </div>
    </div>
  );
}
