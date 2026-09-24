"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ShieldCheck, User, X } from "lucide-react";
import { PageHeader, Shell } from "@/components/Shell";
import { Card, PanelHeader, RouteBadge, actionLabel, cn, fmtUsd } from "@/components/ui";

type Item = {
  caseId: string; action: string; route: "L1" | "L2"; reason: string; exposure: number; verdict: string; pattern: string;
  probability: number; openedAt: string; card: string; decision?: { decision: "approved" | "rejected"; by: string; at: string };
};

const APPROVER = { L1: "team lead", L2: "fraud manager" } as const;

export default function Approvals() {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState<"pending" | "decided" | "all">("pending");
  const [loading, setLoading] = useState(true);
  const load = () => fetch("/api/approvals").then((r) => r.json()).then((d) => setItems(d.items)).finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);

  async function decide(it: Item, decision: "approved" | "rejected") {
    await fetch("/api/approvals", { method: "POST", body: JSON.stringify({ caseId: it.caseId, action: it.action, decision, by: APPROVER[it.route] }) });
    load();
  }

  const shown = items.filter((i) => (filter === "all" ? true : filter === "pending" ? !i.decision : !!i.decision));
  const pending = items.filter((i) => !i.decision);
  const l2 = pending.filter((i) => i.route === "L2").length;

  return (
    <Shell source="HHGOA_IEEE · 20 exam cases" crumbs={<span>Approvals</span>}>
      <PageHeader eyebrow="Investigate" title="Approvals" actions={
        <div className="flex gap-2">
          {(["pending", "decided", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("h-8 rounded-md border border-border px-3 text-xs capitalize text-muted-foreground hover:bg-elevated", filter === f && "bg-elevated text-foreground")}>
              {f}
              {f === "pending" && ` (${pending.length})`}
            </button>
          ))}
        </div>
      }>
        The agent may only execute actions on the <span className="font-mono">auto</span> route. Everything below waits for a person, as Fraud Policy v1.0 §2 requires: declines and blocks up to $2,500 go to a team lead (L1); larger blocks, blocking all cards, and regulatory reports go to a fraud manager (L2).
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Waiting on a fraud manager (L2)", l2, ShieldCheck],
          ["Waiting on a team lead (L1)", pending.length - l2, User],
          ["Approved", items.filter((i) => i.decision?.decision === "approved").length, Check],
          ["Rejected", items.filter((i) => i.decision?.decision === "rejected").length, X],
        ].map(([k, n, Icon]) => {
          const I = Icon as typeof Check;
          return (
            <Card key={k as string} className="p-4">
              <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <I size={13} /> {k as string}
              </div>
              <div className="mt-2 text-[28px] font-semibold tabular-nums">{n as number}</div>
            </Card>
          );
        })}
      </div>

      <Card>
        <PanelHeader title="Queue" right={<span className="text-xs font-normal text-muted-foreground">L2 first, then by exposure</span>} />
        {loading && <div className="p-6 text-xs text-muted-foreground">Loading…</div>}
        {!loading && shown.length === 0 && <div className="p-6 text-[13px] text-muted-foreground">Nothing here.</div>}
        {shown.map((it) => (
          <div key={it.caseId + it.action} className="grid grid-cols-1 gap-3 border-b border-border/60 px-4 py-4 last:border-0 lg:grid-cols-[110px_210px_1fr_230px] lg:items-center">
            <Link href={`/case/${it.caseId}`} className="font-mono text-xs hover:underline">
              {it.caseId}
            </Link>
            <div>
              <div className="text-[13.5px] font-medium">{actionLabel(it.action)}</div>
              <div className="font-mono text-[10.5px] text-subtle">{it.action}</div>
              <div className="mt-1">
                <RouteBadge route={it.route} />
              </div>
            </div>
            <div className="text-[13px]">
              <div>{it.reason}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {it.pattern} · p = {it.probability.toFixed(2)} · exposure {fmtUsd(it.exposure)} · card <span className="font-mono">{it.card}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 lg:justify-end">
              {it.decision ? (
                <span className={cn("text-xs", it.decision.decision === "approved" ? "text-risk-low" : "text-risk-critical")}>
                  {it.decision.decision === "approved" ? "Approved" : "Rejected"} by {it.decision.by} · {new Date(it.decision.at).toLocaleString("en-US")}
                </span>
              ) : (
                <>
                  <button onClick={() => decide(it, "approved")} className="h-8 whitespace-nowrap rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                    Approve as {APPROVER[it.route]}
                  </button>
                  <button onClick={() => decide(it, "rejected")} className="h-8 rounded-md border border-border px-3 text-xs hover:bg-elevated">
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </Card>
    </Shell>
  );
}
