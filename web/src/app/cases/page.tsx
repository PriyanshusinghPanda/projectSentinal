"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, FileWarning } from "lucide-react";
import type { Assessment } from "@/lib/types";
import { Kpi, PageHeader, Shell } from "@/components/Shell";
import { Card, PanelHeader, RouteBadge, RouteChip, TRIGGER_LABEL, actionLabel, cn, fmtUsd } from "@/components/ui";

type Row = {
  id: string; title: string; trigger: keyof typeof TRIGGER_LABEL; customer: { id: string; segment: string }; amount: number; openedAt: string;
  status: string; assessment?: Assessment; needsEvidence?: boolean; verdict?: string; sar?: boolean; exposure?: number; pattern?: string;
  nextAction?: { action: string; route: "auto" | "L1" | "L2" } | null; pendingApprovals?: number; probability?: number; short?: string;
};
type Filter = "all" | "fraud" | "legitimate" | "uncertain";

const VERDICT_TONE: Record<string, string> = { fraud: "text-risk-critical", legitimate: "text-risk-low", uncertain: "text-risk-medium" };

function ProbBar({ p }: { p: number }) {
  const tone = p >= 0.7 ? "bg-risk-critical" : p >= 0.3 ? "bg-risk-medium" : "bg-risk-low";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.max(4, p * 100)}%` }} />
      </div>
      <span className="w-8 font-mono text-xs tabular-nums">{p.toFixed(2)}</span>
    </div>
  );
}

export default function CaseQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [source, setSource] = useState("");
  useEffect(() => {
    fetch("/api/cases" + (typeof window !== "undefined" && window.location.search.includes("demo") ? "?demo=1" : ""))
      .then((r) => r.json())
      .then((d) => {
        setRows(d.cases);
        setSource(d.source);
      })
      .finally(() => setLoading(false));
  }, []);

  const p = (r: Row) => r.probability ?? r.assessment?.riskScore ?? 0;
  const verdictOf = (r: Row) => r.verdict ?? (p(r) >= 0.7 ? "fraud" : p(r) <= 0.2 ? "legitimate" : "uncertain");
  const count = (v: string) => rows.filter((r) => verdictOf(r) === v).length;
  const pending = rows.reduce((a, r) => a + (r.pendingApprovals ?? 0), 0);
  const sars = rows.filter((r) => r.sar).length;
  const byTrigger = Object.entries(rows.reduce<Record<string, number>>((a, r) => ((a[r.trigger] = (a[r.trigger] ?? 0) + 1), a), {}));
  const patterns = Object.entries(rows.filter((r) => verdictOf(r) !== "legitimate").reduce<Record<string, number>>((a, r) => ((a[r.pattern ?? "—"] = (a[r.pattern ?? "—"] ?? 0) + 1), a), {})).sort((a, b) => b[1] - a[1]);
  const attention = rows.filter((r) => (r.pendingApprovals ?? 0) > 0).sort((a, b) => Number(b.sar) - Number(a.sar) || (b.exposure ?? 0) - (a.exposure ?? 0)).slice(0, 5);
  const shown = useMemo(() => [...rows].filter((r) => filter === "all" || verdictOf(r) === filter).sort((a, b) => p(b) - p(a)), [rows, filter]); // eslint-disable-line react-hooks/exhaustive-deps
  const total = Math.max(1, rows.length);

  return (
    <Shell source={source} crumbs={<span>Case queue</span>}>
      <PageHeader eyebrow="Investigate" title="Case queue" actions={<Link href="/approvals" className="flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground hover:bg-primary/90">{pending} awaiting approval <ArrowUpRight size={14} /></Link>}>
        The 20 alerts from the HHGOA_IEEE case pack (November–December 2016), each investigated end to end. Sorted by the agent&apos;s fraud probability — not the bank&apos;s model score, which is often wrong in both directions.
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Alerts investigated" value={rows.length} sub={byTrigger.map(([t, n]) => `${n} ${TRIGGER_LABEL[t as keyof typeof TRIGGER_LABEL]?.toLowerCase() ?? t}`).join(" · ")} />
        <Kpi label="Fraud" value={count("fraud")} bar={count("fraud") / total} tone="critical" sub="blocked or reported under policy" />
        <Kpi label="Legitimate" value={count("legitimate")} bar={count("legitimate") / total} tone="low" sub="closed without customer impact" />
        <Kpi label="Awaiting approval" value={pending} sub="L1 team lead / L2 fraud manager" href="/approvals" />
        <Kpi label="Reports to file" value={sars} sub={`${fmtUsd(rows.reduce((a, r) => a + (r.exposure ?? 0), 0))} total exposure`} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-9">
          <div className="flex h-12 items-center justify-between border-b border-border px-4">
            <div className="flex gap-1">
              {(["all", "fraud", "legitimate", "uncertain"] as Filter[]).map((f) => (
                <button key={f} onClick={() => setFilter(f)} className={cn("h-7 rounded-md px-3 text-[13px] capitalize text-muted-foreground hover:text-foreground", filter === f && "bg-elevated text-foreground")}>
                  {f} <span className="ml-0.5 text-subtle">{f === "all" ? rows.length : count(f)}</span>
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground">sorted by fraud probability</span>
          </div>
          <div className="grid grid-cols-[76px_minmax(0,1fr)_76px_104px_140px_84px] gap-4 border-b border-border bg-muted/40 px-4 py-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <span>Case</span><span>Alert</span><span className="text-right">Amount</span><span>Fraud p</span><span>Next action</span><span>Outcome</span>
          </div>
          {loading && <div className="px-4 py-8 text-xs text-muted-foreground">Loading cases…</div>}
          {shown.map((r) => (
            <Link key={r.id} href={`/case/${r.id}`} className="group grid grid-cols-[76px_minmax(0,1fr)_76px_104px_140px_84px] items-center gap-4 border-b border-border/60 px-4 py-3 transition-colors last:border-0 hover:bg-elevated">
              <div>
                <div className="font-mono text-[12.5px] font-medium">{r.id}</div>
                <div className="mt-0.5 text-[11px] text-subtle">{r.openedAt.slice(5, 16).replace("-", "/")}</div>
              </div>
              <div className="min-w-0">
                <div className="line-clamp-1 text-[13.5px] leading-5" title={r.title}>{r.short ?? r.title}</div>
                <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                  {TRIGGER_LABEL[r.trigger]} · {r.pattern && r.pattern !== "No fraud pattern" ? r.pattern : "no fraud pattern"} · <span className="font-mono">{r.customer.segment}</span>
                </div>
              </div>
              <span className="text-right font-mono text-[12.5px] tabular-nums">{fmtUsd(r.amount)}</span>
              <ProbBar p={p(r)} />
              <div className="min-w-0">
                {r.nextAction ? (
                  <div className="flex items-center gap-2" title={`${r.nextAction.action} · ${r.nextAction.route}`}>
                    <RouteChip route={r.nextAction.route} />
                    <span className="truncate text-[12.5px]">{actionLabel(r.nextAction.action)}</span>
                    {(r.pendingApprovals ?? 0) > 1 && <span className="shrink-0 text-[11px] text-subtle">+{(r.pendingApprovals ?? 0) - 1}</span>}
                  </div>
                ) : (
                  <span className="text-xs text-subtle">—</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className={cn("text-[12.5px] font-medium capitalize", VERDICT_TONE[verdictOf(r)])}>{verdictOf(r)}</span>
                {r.sar && <FileWarning size={13} className="text-route-senior" aria-label="report to file" />}
              </div>
            </Link>
          ))}
        </Card>

        <div className="space-y-4 xl:col-span-3">
          <Card>
            <PanelHeader title="Needs attention" right={<Link href="/approvals" className="text-xs font-normal text-muted-foreground hover:text-foreground">All →</Link>} />
            <div className="divide-y divide-border/60">
              {attention.length === 0 && <div className="p-4 text-xs text-muted-foreground">Nothing waiting.</div>}
              {attention.map((r) => (
                <Link key={r.id} href={`/case/${r.id}`} className="block px-4 py-3 hover:bg-elevated">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{r.id}</span>
                    {r.nextAction && <RouteBadge route={r.nextAction.route} />}
                  </div>
                  <div className="mt-1 text-[12px] text-muted-foreground">
                    {r.pendingApprovals} action{(r.pendingApprovals ?? 0) > 1 ? "s" : ""} to approve{r.sar ? " · includes a regulatory report" : ""} · {fmtUsd(r.exposure ?? 0)}
                  </div>
                </Link>
              ))}
            </div>
          </Card>
          <Card>
            <PanelHeader title="Pattern mix" right={<span className="text-xs font-normal text-muted-foreground">fraud + uncertain</span>} />
            <div className="space-y-2.5 p-4">
              {patterns.map(([name, n]) => (
                <div key={name}>
                  <div className="flex justify-between text-[12.5px]">
                    <span className={cn(name.startsWith("Undocumented") && "text-agent-challenger")}>{name}</span>
                    <span className="tabular-nums text-muted-foreground">{n}</span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-muted">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${(n / Math.max(1, patterns[0]?.[1] ?? 1)) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-[12px] text-muted-foreground">Why the queue isn&apos;t sorted by model score</div>
            <p className="mt-1.5 text-[12.5px] leading-5">Above 0.7, most flagged transactions turn out legitimate and some fraud scores near zero. The agent&apos;s probability comes from graph evidence, case memory and verification.</p>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
