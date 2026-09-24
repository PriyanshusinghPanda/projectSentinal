"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Brain, Home, LayoutGrid, Network, Radar, Scale, Search, UserCheck } from "lucide-react";
import { cn } from "./ui";

const NAV: { group: string; items: { href: string; icon: typeof Home; label: string; match?: (p: string) => boolean }[] }[] = [
  {
    group: "Investigate",
    items: [
      { href: "/cases", icon: LayoutGrid, label: "Case queue", match: (p) => p.startsWith("/case") },
      { href: "/approvals", icon: UserCheck, label: "Approvals" },
      { href: "/monitoring", icon: Radar, label: "Monitoring" },
    ],
  },
  {
    group: "Intelligence",
    items: [
      { href: "/rings", icon: Network, label: "Fraud rings" },
      { href: "/memory", icon: Brain, label: "Case memory" },
    ],
  },
  {
    group: "Governance",
    items: [
      { href: "/evaluation", icon: BarChart3, label: "Evaluation" },
      { href: "/policy", icon: Scale, label: "Fraud policy" },
    ],
  },
];

type CaseRow = { id: string; title: string; customer: { id: string; segment: string } };

/** Jump to a case by ID, card or customer. */
function CaseSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const load = () => {
    if (!rows.length) fetch("/api/cases").then((r) => r.json()).then((d) => setRows(d.cases ?? []));
  };
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return rows.filter((r) => `${r.id} ${r.customer.id} ${r.customer.segment} ${r.title}`.toLowerCase().includes(t)).slice(0, 6);
  }, [q, rows]);
  return (
    <div className="relative hidden md:block">
      <div className="flex h-8 w-[300px] items-center gap-2 rounded-md border border-border bg-card px-2.5 text-xs focus-within:border-accent/50">
        <Search size={13} className="text-subtle" />
        <input
          ref={ref}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => {
            load();
            setOpen(true);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && hits[0]) router.push(`/case/${hits[0].id}`);
          }}
          placeholder="Search case, card or customer"
          className="h-full flex-1 bg-transparent outline-none placeholder:text-subtle"
        />
        <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground">⌘K</kbd>
      </div>
      {open && hits.length > 0 && (
        <div className="absolute right-0 top-10 z-50 w-[400px] overflow-hidden rounded-lg border border-border bg-card shadow-[0_16px_40px_-16px_rgba(32,28,24,0.35)]">
          {hits.map((h) => (
            <Link key={h.id} href={`/case/${h.id}`} className="flex items-center gap-3 border-b border-border/60 px-3 py-2.5 text-[13px] last:border-0 hover:bg-elevated">
              <span className="font-mono text-xs">{h.id}</span>
              <span className="min-w-0 flex-1 truncate">{h.title}</span>
              <span className="font-mono text-[11px] text-subtle">{h.customer.segment}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Status({ source }: { source?: string }) {
  const [agent, setAgent] = useState<"checking" | "up" | "down">("checking");
  useEffect(() => {
    fetch("/api/agent/health")
      .then((r) => setAgent(r.ok ? "up" : "down"))
      .catch(() => setAgent("down"));
  }, []);
  const dot = (ok: boolean | null) => <span className={cn("size-1.5 shrink-0 rounded-full", ok === null ? "bg-subtle" : ok ? "bg-risk-low" : "bg-risk-medium")} />;
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-background/60 p-3 text-[11.5px] text-muted-foreground">
      <div className="flex items-center gap-2">
        {dot(true)} <span className="truncate">Data · {source ?? "HHGOA_IEEE"}</span>
      </div>
      <div className="flex items-center gap-2">
        {dot(agent === "checking" ? null : agent === "up")} TigerGraph agent · {agent === "checking" ? "checking…" : agent === "up" ? "live" : "offline"}
      </div>
    </div>
  );
}

export function Shell({ crumbs, children, source }: { crumbs: React.ReactNode; children: React.ReactNode; source?: string }) {
  const path = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-[232px] shrink-0 flex-col border-r border-border bg-card/60">
        <Link href="/" className="flex h-14 items-center gap-2.5 border-b border-border px-5">
          <span className="font-serif text-[24px] leading-none">Sentinel</span>
          <span className="mt-1 rounded border border-border px-1 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">console</span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <Link href="/" className={cn("mb-4 flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] text-muted-foreground hover:bg-elevated hover:text-foreground", path === "/" && "bg-elevated text-foreground")}>
            <Home size={16} /> Overview
          </Link>
          {NAV.map((g) => (
            <div key={g.group} className="mb-5">
              <div className="mb-1.5 px-2.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-subtle">{g.group}</div>
              {g.items.map(({ href, icon: Icon, label, match }) => {
                const active = match ? match(path) : path.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground",
                      active && "bg-elevated font-medium text-foreground before:absolute before:-left-3 before:top-2 before:h-5 before:w-[3px] before:rounded-r before:bg-accent",
                    )}
                  >
                    <Icon size={16} strokeWidth={active ? 2.2 : 1.8} /> {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="p-3">
          <Status source={source} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-background/85 px-6 backdrop-blur">
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">{crumbs}</div>
          <div className="flex items-center gap-3">
            <span className="hidden rounded-full border border-border px-2.5 py-1 text-[11.5px] text-muted-foreground lg:inline">Exam period · Nov–Dec 2016</span>
            <CaseSearch />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1480px] flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

/** Consistent page header: eyebrow, serif title, one-paragraph description, optional actions. */
export function PageHeader({ eyebrow, title, children, actions }: { eyebrow: string; title: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-6 border-b border-border pb-6">
      <div className="max-w-3xl">
        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-subtle">{eyebrow}</div>
        <h1 className="mt-2 font-serif text-[40px] leading-[1.05] tracking-[-0.01em]">{title}</h1>
        {children && <div className="mt-3 text-[13.5px] leading-6 text-muted-foreground">{children}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** KPI card: label, value, supporting line, optional proportion bar. */
export function Kpi({ label, value, sub, bar, tone = "accent", href }: { label: string; value: React.ReactNode; sub?: React.ReactNode; bar?: number; tone?: "accent" | "critical" | "low" | "medium"; href?: string }) {
  const body = (
    <div className={cn("group h-full rounded-xl border border-border bg-card p-4 transition-colors", href && "hover:border-foreground/25")}>
      <div className="text-[12px] text-muted-foreground">{label}</div>
      <div className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{value}</div>
      {bar !== undefined && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
          <div className={cn("h-full rounded-full", { accent: "bg-accent", critical: "bg-risk-critical", low: "bg-risk-low", medium: "bg-risk-medium" }[tone])} style={{ width: `${Math.max(2, Math.min(100, bar * 100))}%` }} />
        </div>
      )}
      {sub && <div className="mt-2 text-[12px] leading-5 text-muted-foreground">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}
