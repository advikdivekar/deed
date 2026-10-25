"use client";
import type { Clause } from "@/lib/ground";
import { cx } from "./ui";

/** The deed with every call's clause marked. Click a clause to light up its leg in the drawing, and back. */
export function DeedText({ text, clauses, selected, bad, onSelect }: { text: string; clauses: Clause[] | null; selected: number | null; bad: Set<number>; onSelect: (id: number | null) => void }) {
  if (!clauses) return <p className="whitespace-pre-wrap font-mono text-[14px] leading-relaxed">{text}</p>;
  const out: React.ReactNode[] = [];
  let cur = 0;
  clauses.forEach((c, i) => {
    if (c.start > cur) out.push(<span key={`g${i}`} className="text-muted">{text.slice(cur, c.start)}</span>);
    if (i === 0) out.push(<span key="pob">{text.slice(c.start, c.end)}</span>);
    else out.push(<mark key={i} className="clause" data-on={selected === i} data-bad={bad.has(i)} onClick={() => onSelect(selected === i ? null : i)} title={`Call ${i}`}><sup className={cx("mr-0.5 font-mono text-[10px] font-semibold", bad.has(i) ? "text-danger" : "text-accent-text")}>{i}</sup>{text.slice(c.start, c.end)}</mark>);
    cur = c.end;
  });
  if (cur < text.length) out.push(<span key="tail" className="text-muted">{text.slice(cur)}</span>);
  return <p className="whitespace-pre-wrap font-mono text-[14px] leading-[1.9]">{out}</p>;
}
