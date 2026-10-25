import { demoRead } from "./parse";
import type { Deed } from "./types";

export type ReadResult = { deed: Deed; source: "model" | "demo"; confidence?: number };

/** Uses the Python API (fine-tuned model) when it is up, otherwise the in-browser demo reader. */
export async function readDeed(text: string): Promise<ReadResult> {
  if (process.env.NEXT_PUBLIC_BACKEND === "1") {
    try {
      const r = await fetch("/api/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      if (r.ok) return { ...(await r.json()), source: "model" };
    } catch { /* fall through to demo */ }
  }
  await new Promise((r) => setTimeout(r, 900)); // let the scan animation play; the demo reader is instant
  return { deed: demoRead(text), source: "demo" };
}
