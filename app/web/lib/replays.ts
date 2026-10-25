export type Replay = { id: string; title: string; blurb: string; style: string; heldout: boolean; text: string; output: string; minlp_num: number | null; n_prompt: number; n_out: number; model: string };

/** Recorded outputs of the tuned model on test deeds it never saw in training (see eval/make_replays.py). */
export async function loadReplays(): Promise<Replay[]> {
  try {
    const r = await fetch("/replays.json");
    return r.ok ? await r.json() : [];
  } catch { return []; }
}

/** Tinker list prices, USD per token, for the deed-sized cost readout. */
export const PRICE = { prefill: 0.195 / 1e6, sample: 0.6 / 1e6 };
