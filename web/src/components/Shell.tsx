"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Brain, Home, LayoutGrid, Network, Radar, Scale, Search, ShieldHalf, UserCheck } from "lucide-react";
import { cn } from "./ui";

const NAV = [
  { href: "/", icon: Home, label: "Overview" },
  { href: "/cases", icon: LayoutGrid, label: "Case queue" },
  { href: "/approvals", icon: UserCheck, label: "Approvals" },
  { href: "/rings", icon: Network, label: "Fraud rings" },
  { href: "/monitoring", icon: Radar, label: "Monitoring" },
  { href: "/memory", icon: Brain, label: "Case memory" },
  { href: "/evaluation", icon: BarChart3, label: "Evaluation" },
  { href: "/policy", icon: Scale, label: "Policy" },
];

export function Shell({ crumbs, children, source }: { crumbs: React.ReactNode; children: React.ReactNode; source?: string }) {
  const live = !!source && source !== "Mock graph";
  const path = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-14 shrink-0 flex-col items-center gap-2 border-r border-border bg-card/40 py-3">
        <Link href="/" className="mb-3 grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground" title="Sentinel">
          <ShieldHalf size={17} strokeWidth={2.4} />
        </Link>
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = href === "/" ? path === "/" : href === "/cases" ? path.startsWith("/case") : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={cn(
                "grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground",
                active && "bg-elevated text-foreground",
              )}
            >
              <Icon size={17} />
            </Link>
          );
        })}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-border bg-background/80 px-5 backdrop-blur">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="font-medium text-foreground">Sentinel</span>
            <span className="text-subtle">/</span>
            {crumbs}
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden h-8 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-xs text-muted-foreground md:flex">
              <Search size={13} /> Search cases, cards, devices…
              <kbd className="ml-6 rounded border border-border bg-muted px-1 font-mono text-[10px]">⌘K</kbd>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", live ? "bg-risk-low" : "bg-risk-medium")} /> {!source ? "…" : live ? `Live · ${source}` : "Mock data (set TG_HOST for TigerGraph)"}
            </span>
            <div className="grid size-7 place-items-center rounded-full bg-elevated text-[11px] font-medium ring-1 ring-border">AN</div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-5">{children}</main>
      </div>
    </div>
  );
}
