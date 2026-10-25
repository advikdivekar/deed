"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";
import { cx } from "./ui";

const NAV = [{ href: "/studio", label: "Studio" }, { href: "/evidence", label: "Evidence" }];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <>
      <header className="pt-safe sticky top-0 z-30 border-b border-border/70 bg-glass backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex min-h-11 items-center" aria-label="DeedReader home"><Logo size={30} /></Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            {NAV.map(({ href, label }) => (
              <Link key={href} href={href} aria-current={path.startsWith(href) ? "page" : undefined}
                className={cx("inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium transition-colors", path.startsWith(href) ? "text-foreground" : "text-muted hover:text-foreground")}>{label}</Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="flex flex-1 flex-col">{children}</div>
    </>
  );
}
