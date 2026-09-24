"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, Network } from "lucide-react";
import type { Assessment, PastCase } from "@/lib/types";
import { Shell } from "@/components/Shell";
import { AGENTS, AgentAvatar, Card, Label, PanelHeader, RiskBadge, StatusBadge, TRIGGER_LABEL, cn, fmtUsd } from "@/components/ui";

type Row = { id: string; title: string; trigger: keyof typeof TRIGGER_LABEL; customer: { id: string; segment: string }; amount: number; openedAt: string; status: string; assessment?: Assessment; needsEvidence?: boolean; verdict?: string; sar?: boolean; exposure?: number };

export default function Dashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [memory, setMemory] = useState<PastCase[]>([]);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/cases" + (typeof window !== "undefined" && window.location.search.includes("demo") ? "?demo=1" : "")).then((r) => r.json()).then((d) => { setRows(d.cases); setMemory(d.memory); setSource(d.source); }).finally(() => setLoading(false));
  }, []);

  const bands = { critical: 0, high: 0, medium: 0, low: 0 } as Record<Assessment["band"], number>;
  rows.forEach((r) => r.assessment && bands[r.assessment.band]++);
  const needEvidence = rows.filter((r) => r.needsEvidence ?? (r.assessment && !r.assessment.enoughEvidence)).length;
  const exposure = rows.reduce((s, r) => s + (r.exposure ?? ((r.assessment?.riskScore ?? 0) >= 0.6 ? r.amount : 0)), 0);
  const sars = rows.filter((r) => r.sar).length;

  return (
    <Shell source={source} crumbs={<span>Case queue</span>}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="font-serif text-[34px] leading-tight">Case queue</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Alerts from November–December 2016, sorted by assessed fraud probability. Open a case to see the evidence, the challenge, and the recommended actions.</p>
        </div>
        <Link href="/" className="text-[13px] text-muted-foreground hover:text-foreground">About the method →</Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Open cases", rows.length.toString(), "from 3 trigger types"],
          ["Critical / high", `${bands.critical + bands.high}`, "risk ≥ 60%"],
          ["Needed more evidence", needEvidence.toString(), "verify / step-up before acting"],
          ["Exposure at risk", fmtUsd(exposure), sars ? `${sars} SAR${sars > 1 ? "s" : ""} to file` : "risk ≥ 60%"],
        ].map(([k, v, sub]) => (
          <Card key={k} className="p-4">
            <Label>{k}</Label>
            <div className="mt-2 font-mono text-[28px] font-semibold leading-8 tracking-[-0.03em] tabular-nums">{v}</div>
            <div className="mt-1 text-xs text-muted-foreground">{sub}</div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-8">
          <PanelHeader title="Case queue" right={<span className="text-xs font-normal text-muted-foreground">sorted by risk</span>} />
          <div className="grid grid-cols-[96px_1fr_110px_90px_120px_130px_20px] items-center gap-3 border-b border-border bg-muted/40 px-4 py-2 text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
            <span>Case</span><span>Summary</span><span>Trigger</span><span className="text-right">Amount</span><span>Risk</span><span>Status</span><span />
          </div>
          {loading && <div className="px-4 py-6 text-xs text-muted-foreground">Loading cases…</div>}
          {!loading && rows.length === 0 && <div className="px-4 py-6 text-xs text-muted-foreground">No cases. In TigerGraph mode, run tigergraph/prepare_data.py so load_data/benchmark.json exists.</div>}
          {[...rows].sort((a, b) => (b.assessment?.riskScore ?? 0) - (a.assessment?.riskScore ?? 0)).map((r) => (
            <Link key={r.id} href={`/case/${r.id}`} className="group grid grid-cols-[96px_1fr_110px_90px_120px_130px_20px] items-center gap-3 border-b border-border/60 px-4 py-2.5 transition-colors hover:bg-elevated">
              <span className="font-mono text-xs">{r.id}</span>
              <span className="min-w-0">
                <span className="block truncate text-[13px]">{r.title}</span>
                <span className="block text-[11px] text-muted-foreground">{r.customer.id} · {r.customer.segment}{r.assessment?.pattern ? ` · ${r.assessment.pattern.name}` : ""}</span>
              </span>
              <span className="text-xs text-muted-foreground">{TRIGGER_LABEL[r.trigger]}</span>
              <span className="text-right font-mono text-xs tabular-nums">{fmtUsd(r.amount)}</span>
              <span>{r.assessment && <RiskBadge band={r.assessment.band} score={r.assessment.riskScore} />}</span>
              <span><StatusBadge status={r.status} /></span>
              <ArrowUpRight size={14} className="text-subtle transition-colors group-hover:text-foreground" />
            </Link>
          ))}
        </Card>

        <div className="space-y-4 xl:col-span-4">
          <Card>
            <PanelHeader title="Risk distribution" />
            <div className="p-4">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                {(["critical", "high", "medium", "low"] as const).map((b) => (
                  <div key={b} className={cn({ critical: "bg-risk-critical", high: "bg-risk-high", medium: "bg-risk-medium", low: "bg-risk-low" }[b])} style={{ width: `${(bands[b] / Math.max(1, rows.length)) * 100}%` }} />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-4 text-xs">
                {(["critical", "high", "medium", "low"] as const).map((b) => (
                  <div key={b}><div className="capitalize text-muted-foreground">{b}</div><div className="font-mono tabular-nums">{bands[b]}</div></div>
                ))}
              </div>
            </div>
          </Card>
          <Card>
            <PanelHeader title="How the agents work" right={<Network size={14} className="text-muted-foreground" />} />
            <ol className="space-y-2.5 p-4 text-xs text-muted-foreground">
              {[
                ["orchestrator", "Opens the case from a trigger and dispatches specialists"],
                ["graph", "Traverses devices, IPs, cards via GSQL on TigerGraph"],
                ["memory", "Retrieves similar past cases & outcomes (GraphRAG)"],
                ["policy", "Grounds the case in policy, typologies & SAR rules"],
                ["challenger", "Argues the opposite — disputes weak findings"],
                ["orchestrator", "Weighs disputes, asks for evidence or acts within permissions"],
              ].map(([a, t], i) => (
                <li key={i} className="flex items-center gap-2.5"><AgentAvatar id={a as keyof typeof AGENTS} size={20} /><span>{t}</span></li>
              ))}
            </ol>
          </Card>
          <Card>
            <PanelHeader title="Case memory" right={<Link href="/memory" className="text-xs font-normal text-muted-foreground hover:text-foreground">View all →</Link>} />
            <div className="p-4 text-xs text-muted-foreground">
              <span className="font-mono text-foreground">{memory.length}</span> closed investigations ·{" "}
              <span className="font-mono text-foreground">{memory.filter((m) => m.outcome === "confirmed_fraud").length}</span> confirmed fraud · used as precedent for every new case.
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
