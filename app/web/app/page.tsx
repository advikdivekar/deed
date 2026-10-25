import { ArrowRight, Check, FileText, HardDrive, ShieldCheck, WifiOff } from "lucide-react";
import Link from "next/link";
import { HeroScene } from "@/components/landing/scene";
import { LpRoot } from "@/components/landing/lp-root";
import { Race } from "@/components/landing/race";
import { Logo } from "@/components/logo";

const STEPS = [
  ["01", "Paste", "Drop in the legal description exactly as it appears: thence, to a white oak, more or less, chains and poles included."],
  ["02", "Glance", "The tuned model reads the calls. Plain code checks closure, finds the area, and plots the parcel. If it does not close, it says which call to look at."],
  ["03", "Approve", "One tap sends you structured JSON and a drawing. Fifteen minutes of plotting becomes under one."],
] as const;

export default function Home() {
  return (
    <LpRoot>
      <header className="fixed inset-x-0 top-0 z-50 bg-[rgb(0_49_53/.7)] backdrop-blur-xl" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="wrap flex h-16 items-center justify-between">
          <Link href="/" className="flex min-h-11 items-center" aria-label="DeedReader home"><Logo size={32} tone="light" /></Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            <a href="#how" className="hidden min-h-11 items-center rounded-full px-4 text-sm text-[var(--paper)]/80 hover:text-white sm:inline-flex">How it works</a>
            <a href="#trust" className="hidden min-h-11 items-center rounded-full px-4 text-sm text-[var(--paper)]/80 hover:text-white sm:inline-flex">Own the weights</a>
            <Link href="/evidence" className="hidden min-h-11 items-center rounded-full px-4 text-sm text-[var(--paper)]/80 hover:text-white sm:inline-flex">Evidence</Link>
            <Link href="/studio" className="btn btn-turq !min-h-11 !px-5 text-sm">Open the studio</Link>
          </nav>
        </div>
      </header>

      <section className="relative isolate flex min-h-[100svh] flex-col overflow-hidden" aria-labelledby="hero-h">
        <div className="absolute inset-x-0 top-0 h-[62svh] md:inset-0 md:h-auto"><HeroScene /></div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 top-[36svh] md:top-[55%]" style={{ background: "linear-gradient(to bottom, transparent, rgb(0 49 53 / .55) 40%, rgb(0 49 53 / .97))" }} aria-hidden />
        <div className="pointer-events-none absolute inset-0 hidden md:block" style={{ background: "linear-gradient(to right, rgb(0 49 53 / .65), rgb(0 49 53 / .2) 40%, transparent 60%)" }} aria-hidden />
        <div className="wrap relative z-10 mt-auto pb-10 pt-[50svh] md:pb-16 md:pt-0">
          <div className="grid gap-7 md:max-w-[46rem]">
            <div>
              <p className="label tick mb-4 flex items-center gap-2"><span className="size-1.5 rounded-full bg-[var(--turq-soft)]" style={{ animation: "lp-pulse 2s infinite" }} />Introducing deedreader</p>
              <h1 id="hero-h" className="display-hero text-white">
                {["Paste the deed.", "Glance at the drawing.", "Approve."].map((line, i) => (
                  <span key={line} className="block"><span className="word"><span style={{ ["--d" as string]: `${0.1 + i * 0.12}s` }} className={i === 2 ? "text-[var(--ice)]" : ""}>{line}{i === 2 && <span aria-hidden className="ml-3 inline-block text-[.6em] text-[var(--turq-soft)]">→</span>}</span></span></span>
                ))}
              </h1>
            </div>
            <div>
              <p className="lede max-w-md text-[var(--paper)]/80">Metes-and-bounds descriptions in, a closed and plotted parcel out. Fifteen to thirty minutes of manual plotting, down to under one.</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link href="/studio" className="btn btn-turq w-full sm:w-auto">Plot your first deed <ArrowRight className="size-4" aria-hidden /></Link>
                <a href="#how" className="btn btn-ghost w-full sm:w-auto">See how it works</a>
              </div>
              <p className="mt-4 text-[13px] text-[var(--paper)]/60">Open weights. Runs on your computer. A parcel that does not close is never passed off as fine.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="light py-20 md:py-28">
        <div className="wrap">
          <p className="label muted reveal mb-3">How it works</p>
          <h2 className="h2 reveal max-w-2xl" style={{ ["--d" as string]: ".05s" }}>The model reads. <span className="font-light text-[#037A84]">The math decides.</span></h2>
          <ol className="mt-12 grid gap-4 md:grid-cols-3">
            {STEPS.map(([n, t, d], i) => (
              <li key={n} className="panel-l reveal p-6" style={{ ["--d" as string]: `${i * 0.08}s` }}>
                <p className="label muted">{n}</p><h3 className="mt-6 text-2xl font-medium">{t}</h3><p className="muted mt-2 text-[15px]">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="py-20 md:py-28">
        <div className="wrap">
          <p className="label tick reveal mb-3">The lazy payoff</p>
          <h2 className="h2 reveal mb-10 max-w-2xl" style={{ ["--d" as string]: ".05s" }}>Twenty minutes of plotting, <span className="font-light text-[var(--turq-soft)]">one glance.</span></h2>
          <Race />
        </div>
      </section>

      <section className="pb-20 md:pb-28">
        <div className="wrap grid items-center gap-10 md:grid-cols-2">
          <div>
            <p className="label tick reveal mb-3">The silent-error number</p>
            <h2 className="h2 reveal" style={{ ["--d" as string]: ".05s" }}>A wrong answer that looks right is the <span className="font-light text-[var(--turq-soft)]">only kind that matters.</span></h2>
            <p className="lede muted reveal mt-5 max-w-md" style={{ ["--d" as string]: ".1s" }}>Every output passes a deterministic closure check. If it fails, DeedReader tries single-field fixes (flipped quadrants, transposed digits), reports the one that closes, and stamps the result NEEDS HUMAN REVIEW.</p>
          </div>
          <div className="panel reveal p-5 font-mono text-[13px] leading-relaxed" style={{ ["--d" as string]: ".12s" }}>
            <p className="label muted mb-3">closure.check()</p>
            <p><span className="muted">call 2</span>  N 86°29′ E  <span className="text-[#E39C86]">103.2 ft</span></p>
            <p className="text-[#E39C86]">⚠ misclosure 27.0 ft · 1:22 · NEEDS HUMAN REVIEW</p>
            <p className="mt-3"><span className="muted">try</span> distance 103.2 → <span className="text-[var(--turq-soft)]">130.2</span></p>
            <p className="tick"><Check className="mr-1 inline size-3.5" aria-hidden />closes · 1:20,605</p>
          </div>
        </div>
      </section>

      <section id="trust" className="light py-20 md:py-28">
        <div className="wrap">
          <p className="label muted reveal mb-3">Open innovation</p>
          <h2 className="h2 reveal max-w-2xl" style={{ ["--d" as string]: ".05s" }}>We rented the training. <span className="font-light text-[#037A84]">You own the weights.</span></h2>
          <ul className="mt-12 grid gap-4 md:grid-cols-3">
            {([[WifiOff, "Runs offline", "Download the adapter once. No internet needed to read a deed."], [ShieldCheck, "Client documents stay put", "Titles, names and parcels never leave the office."], [HardDrive, "No per-document fees", "After a few dollars of fine-tuning, every deed is free."]] as const).map(([Icon, t, d], i) => (
              <li key={t} className="panel-l reveal p-6" style={{ ["--d" as string]: `${i * 0.08}s` }}><Icon className="size-6 text-[#037A84]" aria-hidden /><h3 className="mt-6 text-xl font-medium">{t}</h3><p className="muted mt-2 text-[15px]">{d}</p></li>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-20 text-center md:py-28">
        <div className="wrap">
          <FileText className="tick mx-auto mb-6 size-8" aria-hidden />
          <h2 className="h2 mx-auto max-w-xl">Stop plotting by hand.</h2>
          <Link href="/studio" className="btn btn-turq mt-8">Open the studio <ArrowRight className="size-4" aria-hidden /></Link>
        </div>
      </section>
      <footer className="border-t border-[var(--line-d)] py-8"><div className="wrap flex flex-wrap items-center justify-between gap-3 text-[13px] muted"><Logo size={24} tone="light" /><span>Built for the DEV Open-Source AI Challenge · Fine-tuned with Tinker · Not a substitute for a licensed surveyor.</span></div></footer>
    </LpRoot>
  );
}
