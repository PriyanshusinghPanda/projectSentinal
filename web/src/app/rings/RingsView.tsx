"use client";
import { useState } from "react";
import { PageHeader, Shell } from "@/components/Shell";
import { EntityGraph } from "@/components/EntityGraph";
import { Card, Label, PanelHeader, cn, fmtUsd } from "@/components/ui";
import type { GraphEdge, GraphNode } from "@/lib/types";
import type { RingComponent } from "@/lib/insights";

const MAX_CUSTOMERS = 22;

function graphOf(c: RingComponent) {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  c.devices.forEach((d, i) => nodes.push({ id: `d${i}`, kind: "device", label: d.length > 30 ? d.slice(0, 30) + "…" : d, subject: i === 0, flagged: c.fraud_cases.length > 0 }));
  const shown = c.customers.slice(0, MAX_CUSTOMERS);
  shown.forEach((cu, i) => {
    nodes.push({ id: `c${i}`, kind: "account", label: cu });
    edges.push({ from: `c${i}`, to: `d${i % c.devices.length}`, label: "" });
  });
  if (c.customers.length > MAX_CUSTOMERS) {
    nodes.push({ id: "more", kind: "account", label: `+${c.customers.length - MAX_CUSTOMERS} more` });
    edges.push({ from: "more", to: "d0", label: "" });
  }
  c.fraud_cases.slice(0, 4).forEach((f, i) => {
    nodes.push({ id: `f${i}`, kind: "merchant", label: f, flagged: true });
    edges.push({ from: "d0", to: `f${i}`, label: "" });
  });
  return { nodes, edges };
}

export function RingsView({ meta, components }: { meta: { iterations: number; suspicious_txns: number }; components: RingComponent[] }) {
  const [sel, setSel] = useState(0);
  const c = components[sel];
  const g = c ? graphOf(c) : null;
  return (
    <Shell source="TigerGraph · ring_components" crumbs={<span>Fraud rings</span>}>
      <PageHeader eyebrow="Intelligence" title="Fraud rings">
        A connected-components algorithm runs inside TigerGraph (<span className="font-mono">ring_components</span>, GSQL) over every transaction made from a device new to the account and behind an anonymous or hidden proxy — {meta.suspicious_txns.toLocaleString("en-US")} transactions across six months, converged in {meta.iterations} iterations. Customers joined by such devices collapse into one component. No alert has to point at a ring for it to be found.
      </PageHeader>
      {!c && <div className="text-[13px] text-muted-foreground">No ring data — run agent/export_insights.py with TigerGraph configured.</div>}
      {c && g && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <Card className="xl:col-span-4">
            <PanelHeader title={`Components with ≥ 3 customers (${components.length})`} />
            <div className="max-h-[640px] overflow-y-auto">
              {components.map((r, i) => (
                <button key={r.id} onClick={() => setSel(i)} className={cn("flex w-full items-center justify-between gap-3 border-b border-border/60 px-4 py-3 text-left hover:bg-elevated", i === sel && "bg-elevated")}>
                  <div className="min-w-0">
                    <div className="truncate font-mono text-[12px]">{r.devices[0]}</div>
                    <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {r.customers.length} customers · {r.devices.length} device{r.devices.length > 1 ? "s" : ""} · {fmtUsd(r.amount)}
                    </div>
                  </div>
                  {r.fraud_cases.length > 0 && <span className="shrink-0 rounded-md bg-risk-critical/10 px-1.5 py-0.5 text-[11px] text-risk-critical">{r.fraud_cases.length} fraud</span>}
                </button>
              ))}
            </div>
          </Card>
          <div className="space-y-4 xl:col-span-8">
            <Card className="overflow-hidden">
              <PanelHeader title="Component" right={<span className="font-mono text-[11px] font-normal text-muted-foreground">{c.customers.length} customers · {c.devices.length} devices · {c.txns} txns</span>} />
              <EntityGraph nodes={g.nodes} edges={g.edges} height={470} />
            </Card>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {[
                ["Customers", c.customers.length.toString()],
                ["Device profiles", c.devices.length.toString()],
                ["Suspicious transactions", c.txns.toString()],
                ["Amount", fmtUsd(c.amount)],
              ].map(([k, v]) => (
                <Card key={k} className="p-4">
                  <Label>{k}</Label>
                  <div className="mt-2 text-[24px] font-semibold tabular-nums">{v}</div>
                </Card>
              ))}
            </div>
            <Card className="p-4">
              <Label>Reading this component</Label>
              <p className="mt-2 text-[13px] leading-6 text-foreground/90">
                {c.devices.length <= 2 && c.customers.length >= 3
                  ? `One or two device profiles shared by ${c.customers.length} customers, each marked New for the account and routed through a proxy — the signature of one actor using one device across many cardholders.`
                  : `${c.devices.length} device profiles chained through shared customers. Components this broad usually reflect common browser profiles rather than one actor; treat as a lead, not a ring.`}{" "}
                {c.fraud_cases.length > 0 ? `Confirmed-fraud closed cases already sit on it: ${c.fraud_cases.join(", ")}.` : "No confirmed-fraud closed case touches it yet."}
              </p>
            </Card>
          </div>
        </div>
      )}
    </Shell>
  );
}
