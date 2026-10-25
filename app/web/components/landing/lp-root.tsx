"use client";
import { useEffect, useRef } from "react";

/** Wraps the landing page: marks it JS-enhanced, then reveals .reveal elements as they scroll into view. */
export function LpRoot({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.classList.add("js");
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    root.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className="lp">{children}</div>;
}
