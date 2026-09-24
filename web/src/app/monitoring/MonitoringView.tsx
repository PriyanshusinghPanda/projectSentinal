"use client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Shell } from "@/components/Shell";
import { Card, Label, PanelHeader, cn, fmtUsd } from "@/components/ui";
import type { MonitoringSummary } from "@/lib/insights";

type Detail = { case: { summary: string; evidence: { claim: string; ref: string }[]; similar_prior_cases: string[] }; next_best_actions: { initial: { action: string; route: string; reason: string }[] }; stop_reason: string };

export function MonitoringView({ s }: { s: MonitoringSummary | null }) {
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, Detail>>({});
  if (!s)
    return (
      <Shell source="Autonomous monitoring" crumbs={<span>Monitoring</span>}>
        <div className="text-[13px] text-muted-foreground">No monitoring run yet — run agent/monitor.py, then agent/export_insights.py.</div>
      </Shell>
    );
  const triageTotal = Object.values(s.triage).reduce((a, b) => a + b, 0) || 1;
  const toggle = async (id: string) => {
    setOpen(open === id ? null : id);
    if (!detail[id]) {
      const d = await fetch(`/api/monitoring/${id}`).then((r) => r.json());
      setDetail((x) => ({ ...x, [id]: d }));
    }
  };
  const funnel: [string, number][] = [
    ["Transactions scanned (Nov–Dec)", s.period_txns],
    [`Alerts: model score ≥ ${s.threshold}`, s.model_alerts],
    ["Alerts: device in a TigerGraph ring component", s.ring_alerts],
    ["Card-day alerts after de-duplication", s.card_days],
    ["Investigated in full", s.investigated.length],
  ];
  return (
    <Shell source="Autonomous monitoring" crumbs={<span>Monitoring</span>}>
      <div className="mb-6 border-b border-border pb-5">
        <h1 className="font-serif text-[34px] leading-tight">Autonomous monitoring</h1>
        <p className="mt-1 max-w-3xl text-[13px] text-muted-foreground">
          Beyond the 20 case-pack alerts, the agent watched the exam period on its own: it raised alerts from the bank&apos;s risk scores and from TigerGraph&apos;s ring components, triaged every one with its own pre-evidence probability, and opened full investigations for the most serious. These cases are open — verification has been requested and no reply has come back.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-5">
          <PanelHeader title="Funnel" />
          <div className="p-4">
            {funnel.map(([k, n], i) => (
              <div key={k} className="mb-3">
                <div className="flex justify-between text-[13px]">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="font-medium tabular-nums">{n.toLocaleString("en-US")}</span>
                </div>
                <div className="mt-1 h-1.5 bg-muted">
                  <div className="h-full bg-accent" style={{ width: `${Math.max(1.5, (Math.log10(n + 1) / Math.log10(funnel[0][1] + 1)) * 100)}%`, opacity: 1 - i * 0.12 }} />
                </div>
              </div>
            ))}
            <p className="mt-2 text-[11.5px] text-subtle">Bar length on a log scale.</p>
          </div>
        </Card>
        <Card className="xl:col-span-3">
          <PanelHeader title="Triage (pre-evidence probability)" />
          <div className="space-y-3 p-4">
            {["≥0.70", "0.30–0.70", "<0.30"].map((k) => (
              <div key={k}>
                <div className="flex justify-between text-[13px]">
                  <span className="font-mono">{k}</span>
                  <span className="tabular-nums">{(s.triage[k] ?? 0).toLocaleString("en-US")}</span>
                </div>
                <div className="mt-1 h-1.5 bg-muted">
                  <div className={cn("h-full", k === "≥0.70" ? "bg-risk-critical" : k === "<0.30" ? "bg-risk-low" : "bg-risk-medium")} style={{ width: `${((s.triage[k] ?? 0) / triageTotal) * 100}%` }} />
                </div>
              </div>
            ))}
            <p className="text-[12px] leading-5 text-muted-foreground">Only {Math.round(((s.triage["≥0.70"] ?? 0) / triageTotal) * 100)}% of alerts reach 0.70 before verification; the rest go to verification (R1) or are cleared.</p>
          </div>
        </Card>
        <Card className="xl:col-span-4">
          <PanelHeader title="Patterns among alerts ≥ 0.30" />
          <div className="p-4">
            {Object.entries(s.patterns).map(([p, n]) => (
              <div key={p} className="flex justify-between border-b border-border/60 py-2 text-[13px] last:border-0">
                <span className={cn(p === "undocumented" && "text-agent-challenger")}>{p.replace(/_/g, " ")}</span>
                <span className="tabular-nums text-muted-foreground">{n}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <PanelHeader title={`Open investigations (${s.investigated.length})`} right={<span className="text-xs font-normal text-muted-foreground">each written to TigerGraph as an InvestigationCase</span>} />
        {s.investigated.map((r) => (
          <div key={r.id} className="border-b border-border/60 last:border-0">
            <button onClick={() => toggle(r.id)} className="grid w-full grid-cols-[130px_120px_90px_90px_1fr_110px_20px] items-center gap-3 px-4 py-3 text-left text-[13px] hover:bg-elevated">
              <span className="font-mono text-xs">{r.id}</span>
              <span className="text-xs text-muted-foreground">{r.opened_at.slice(0, 16)}</span>
              <span className="text-right font-mono text-xs tabular-nums">{fmtUsd(r.amount)}</span>
              <span className="text-right font-mono text-xs tabular-nums">p {r.p0.toFixed(2)}</span>
              <span className="truncate">
                {r.pattern.replace(/_/g, " ")}
                {r.ring && <span className="ml-2 rounded bg-risk-critical/10 px-1.5 py-0.5 text-[11px] text-risk-critical">ring</span>}
              </span>
              <span className={cn("text-xs", r.verdict === "fraud" ? "text-risk-critical" : "text-risk-medium")}>{r.verdict} · {r.status}</span>
              <ChevronDown size={14} className={cn("text-subtle transition-transform", open === r.id && "rotate-180")} />
            </button>
            {open === r.id && (
              <div className="grid gap-4 bg-muted/30 px-4 py-4 md:grid-cols-2">
                <div>
                  <Label>Evidence</Label>
                  <ul className="mt-2 space-y-1.5 text-[12.5px] leading-5">
                    {(detail[r.id]?.case.evidence ?? []).map((e, i) => (
                      <li key={i}>
                        {e.claim} <span className="font-mono text-[10.5px] text-subtle">{e.ref}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <Label>Recommended now (verification pending)</Label>
                  <ul className="mt-2 space-y-1.5 text-[12.5px]">
                    {(detail[r.id]?.next_best_actions.initial ?? []).map((a, i) => (
                      <li key={i}>
                        <span className="font-mono">{a.action}</span> <span className="text-muted-foreground">({a.route}) — {a.reason}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[12px] text-muted-foreground">{detail[r.id]?.stop_reason}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </Card>
    </Shell>
  );
}
