"use client";
import { Brain, Fingerprint, GitFork, Network, Receipt, Scale, ShieldCheck, Swords, User, Zap } from "lucide-react";
import type { AgentId, ApprovalRoute, Assessment } from "@/lib/types";

import { cn } from "@/lib/cn";
export { cn };

export const AGENTS: Record<AgentId, { name: string; icon: typeof Network; var: string; text: string }> = {
  graph: { name: "Graph Analyst", icon: Network, var: "--agent-graph", text: "text-agent-graph" },
  txn: { name: "Transaction Analyst", icon: Receipt, var: "--agent-txn", text: "text-agent-txn" },
  device: { name: "Device & Identity", icon: Fingerprint, var: "--agent-device", text: "text-agent-device" },
  memory: { name: "Case Memory", icon: Brain, var: "--agent-memory", text: "text-agent-memory" },
  policy: { name: "Policy & Compliance", icon: Scale, var: "--agent-policy", text: "text-agent-policy" },
  challenger: { name: "Challenger", icon: Swords, var: "--agent-challenger", text: "text-agent-challenger" },
  orchestrator: { name: "Orchestrator", icon: GitFork, var: "--agent-orchestrator", text: "text-agent-orchestrator" },
};

export function AgentAvatar({ id, size = 24 }: { id: AgentId; size?: number }) {
  const a = AGENTS[id];
  const Icon = a.icon;
  return (
    <span
      style={{ ["--agent" as string]: `var(${a.var})`, width: size, height: size }}
      className="grid shrink-0 place-items-center rounded-md bg-[hsl(var(--agent)/0.14)] text-[hsl(var(--agent))] ring-1 ring-inset ring-[hsl(var(--agent)/0.3)]"
      title={a.name}
    >
      <Icon size={size * 0.55} strokeWidth={2} />
    </span>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("rounded-xl border border-border bg-card", className)}>{children}</div>;
}

export function PanelHeader({ title, right, className }: { title: React.ReactNode; right?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-11 items-center justify-between border-b border-border px-4 text-[14px] font-semibold tracking-[-0.01em]", className)}>
      <div className="flex items-center gap-2">{title}</div>
      {right}
    </div>
  );
}

export const Label = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <div className={cn("text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground", className)}>{children}</div>
);

const badge = "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap";

const RISK = {
  critical: "border-risk-critical/30 bg-risk-critical/10 text-risk-critical",
  high: "border-risk-high/30 bg-risk-high/10 text-risk-high",
  medium: "border-risk-medium/30 bg-risk-medium/10 text-risk-medium",
  low: "border-risk-low/30 bg-risk-low/10 text-risk-low",
};

export function RiskBadge({ band, score }: { band: Assessment["band"]; score?: number }) {
  return (
    <span className={cn(badge, RISK[band])}>
      <span className={cn("size-1.5 rounded-full bg-current", band === "critical" && "animate-pulse")} />
      {band[0].toUpperCase() + band.slice(1)}
      {score !== undefined && <span className="font-mono tabular-nums opacity-80">{Math.round(score * 100)}</span>}
    </span>
  );
}

const ROUTE: Record<ApprovalRoute, { cls: string; icon: typeof Zap; label: string }> = {
  auto: { cls: "border-route-auto/30 bg-route-auto/10 text-route-auto", icon: Zap, label: "Auto" },
  analyst: { cls: "border-route-analyst/30 bg-route-analyst/10 text-route-analyst", icon: User, label: "Analyst" },
  senior_compliance: { cls: "border-route-senior/30 bg-route-senior/10 text-route-senior", icon: ShieldCheck, label: "Senior compliance" },
  L1: { cls: "border-route-analyst/30 bg-route-analyst/10 text-route-analyst", icon: User, label: "L1 · team lead" },
  L2: { cls: "border-route-senior/30 bg-route-senior/10 text-route-senior", icon: ShieldCheck, label: "L2 · fraud manager" },
};

export function RouteBadge({ route }: { route: ApprovalRoute }) {
  const r = ROUTE[route];
  const Icon = r.icon;
  return (
    <span className={cn(badge, r.cls)}>
      <Icon size={11} />
      {r.label}
    </span>
  );
}

const STATUS: Record<string, string> = {
  new: "text-muted-foreground",
  awaiting_evidence: "text-risk-medium",
  pending_approval: "text-route-analyst",
  escalated: "text-risk-high",
  open: "text-risk-medium",
  closed_legitimate: "text-risk-low",
  resolved_legit: "text-risk-low",
  closed_fraud: "text-risk-critical",
  closed_legit: "text-risk-low",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={cn(badge, "border-border bg-muted", STATUS[status] ?? "text-muted-foreground")}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export const riskColor = (band: Assessment["band"]) =>
  ({ critical: "hsl(var(--risk-critical))", high: "hsl(var(--risk-high))", medium: "hsl(var(--risk-medium))", low: "hsl(var(--risk-low))" })[band];

export const fmtUsd = (n: number) => "$" + n.toLocaleString("en-US", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });

export const TRIGGER_LABEL = { risk_score: "Risk score", customer_report: "Customer report", analyst_request: "Analyst request" } as const;
