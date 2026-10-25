# Cost log

Costs are ESTIMATES from token counts x list price (pricing page dated 2026-10-19), not billed amounts, unless marked billed.

| time (UTC) | job | model | tokens / steps | est. cost | result |
|---|---|---|---|---|---|
| 2026-10-25 11:22 | eval base_qwen3_8b_fs3 | Qwen/Qwen3-8B | 200,815 prefill + 25,771 sampled | $0.055 | exact 5/60 on test_id |
| 2026-10-25 11:24 | eval base_qwen3_8b_fs3 | Qwen/Qwen3-8B | 199,845 prefill + 25,639 sampled | $0.054 | exact 5/60 on test_id |
| 2026-10-25 11:39 | sft qwen8b-r32-n2k | Qwen/Qwen3-8B | 2,298,891 train tokens, 375 steps, bs=16, rank=32, lr=0.0002 | $1.012 | checkpoints saved: ep1, ep2, ep3 |
| 2026-10-25 11:42 | eval tuned_ep3 | tinker://954cafcc-3f6e-5526-96b2-c5ab8d932cd6:train:0/sampler_weights/qwen8b-r32-n2k-ep3 | 275,016 prefill + 171,148 sampled | $0.156 | exact 200/200 on val |
| 2026-10-25 11:45 | eval tuned_ep1 | tinker://954cafcc-3f6e-5526-96b2-c5ab8d932cd6:train:0/sampler_weights/qwen8b-r32-n2k-ep1 | 171,312 prefill + 107,324 sampled | $0.098 | exact 498/500 on test_id |
| 2026-10-25 11:46 | eval tuned_ep2 | tinker://954cafcc-3f6e-5526-96b2-c5ab8d932cd6:train:0/sampler_weights/qwen8b-r32-n2k-ep2 | 171,312 prefill + 107,333 sampled | $0.098 | exact 500/500 on test_id |
| 2026-10-25 11:48 | sft curve-n250 | Qwen/Qwen3-8B | 94,305 train tokens, 15 steps, bs=16, rank=32, lr=0.0002 | $0.041 | checkpoints saved: ep1 |
| 2026-10-25 11:49 | sft curve-n500 | Qwen/Qwen3-8B | 190,603 train tokens, 31 steps, bs=16, rank=32, lr=0.0002 | $0.084 | checkpoints saved: ep1 |
| 2026-10-25 11:52 | sft curve-n1000 | Qwen/Qwen3-8B | 381,153 train tokens, 62 steps, bs=16, rank=32, lr=0.0002 | $0.168 | checkpoints saved: ep1 |
| 2026-10-25 11:54 | eval curve_n250 | tinker://fbe7dc6b-432d-5ee0-9f22-ddb19175f982:train:0/sampler_weights/curve-n250-ep1 | 171,312 prefill + 110,700 sampled | $0.100 | exact 193/500 on test_id |
| 2026-10-25 11:56 | eval curve_n500 | tinker://1900fa36-560a-5688-bc1c-c5df2b1655ef:train:0/sampler_weights/curve-n500-ep1 | 171,312 prefill + 107,640 sampled | $0.098 | exact 463/500 on test_id |
| 2026-10-25 11:58 | eval curve_n1000 | tinker://024bba03-3462-5110-8b11-2b4df769170f:train:0/sampler_weights/curve-n1000-ep1 | 171,312 prefill + 107,262 sampled | $0.098 | exact 497/500 on test_id |
| 2026-10-25 11:59 | sft qwen8b-r32-v2 | Qwen/Qwen3-8B | 2,613,423 train tokens, 429 steps, bs=16, rank=32, lr=0.0002 | $1.150 | checkpoints saved: ep1, ep2, ep3 |
| 2026-10-25 12:09 | eval v2_ep3 | tinker://f8f9085c-bab4-5957-9c0b-973928fff482:train:0/sampler_weights/qwen8b-r32-v2-ep3 | 1,048,052 prefill + 642,179 sampled | $0.590 | exact 2988/3000 on test_id_big |

**Totals (estimates):** training $2.46 (v1 $1.01, v2 final $1.15, learning-curve runs $0.29) · evaluation $1.35 (baseline $0.11, tuned $1.24) · **all Tinker spend about $3.80**. Final model alone: $1.15 train + $0.59 for its 4,250-deed evaluation. Offline local evaluation: $0. Tinker's billing endpoint had not yet reported training/sampling usage when checked, so these remain token-count estimates, not billed amounts.
