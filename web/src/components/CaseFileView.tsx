"use client";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Database, FileWarning, ShieldCheck } from "lucide-react";
import { Label, RouteBadge, cn, fmtUsd } from "./ui";

type Act = { action: string; route: "auto" | "L1" | "L2"; reason: string };
type Answer = {
  case_id: string;
  case: {
    status: string; verdict: string; fraud_probability: number; pattern: string; pattern_description: string; affected_txn_ids: string[];
    first_suspicious_txn_id: string; connected_card_ids: string[]; connected_device_profiles: string[]; exposure_usd: number;
    evidence: { claim: string; source: string; ref: string; entity_ids: string[] }[]; similar_prior_cases: string[]; summary: string;
    written_to_graph: boolean; graph_case_id: string;
  };
  evidence_requests: { type: string; asked_after_step: number; assumed_response: string }[];
  next_best_actions: { initial: Act[]; final: Act[]; what_changed: string };
  sar: { file: boolean; reason: string; narrative: string; subjects: string[]; total_amount_usd: number; activity_dates: string[] };
  stop_reason: string; tool_calls: number; tokens: number; latency_s: number;
};

const SRC: Record<string, string> = { graph: "bg-accent/10 text-accent", document: "bg-agent-policy/10 text-agent-policy", customer: "bg-risk-medium/10 text-risk-medium", external: "bg-muted text-muted-foreground" };

/** The graded case record for this case, rendered for an analyst (exactly what's in cases/<id>.json for this reply). */
export function CaseFileView({ id, reply, version }: { id: string; reply: string; version: number }) {
  const [a, setA] = useState<Answer | null>(null);
  const [audit, setAudit] = useState<string[] | null>(null);
  useEffect(() => {
    setA(null);
    fetch(`/api/answer/${id}?reply=${reply}&inline=1`).then((r) => r.json()).then(setA);
    fetch(`/api/insights/audit`).then((r) => r.json()).then((d) => setAudit(d?.[id] ?? null));
  }, [id, reply, version]);
  if (!a) return <div className="text-xs text-muted-foreground">Loading case file…</div>;
  const c = a.case;
  const initial = new Set(a.next_best_actions.initial.map((x) => x.action));
  const final = new Set(a.next_best_actions.final.map((x) => x.action));
  return (
    <div className="space-y-6 text-[13px]">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {[
          ["Status", c.status.replace("_", " ")],
          ["Verdict", `${c.verdict} · p ${c.fraud_probability.toFixed(2)}`],
          ["Pattern", c.pattern.replace(/_/g, " ")],
          ["Exposure", fmtUsd(c.exposure_usd)],
        ].map(([k, v]) => (
          <div key={k}>
            <Label>{k}</Label>
            <div className="mt-1 font-medium capitalize">{v}</div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-[11.5px]">
        <span className={cn("flex items-center gap-1 rounded-md px-2 py-1", c.written_to_graph ? "bg-risk-low/10 text-risk-low" : "bg-muted text-muted-foreground")}>
          <Database size={12} /> {c.written_to_graph ? `Written to TigerGraph as ${c.graph_case_id}` : "Not written to the graph"}
        </span>
        {audit && (
          <span className={cn("flex items-center gap-1 rounded-md px-2 py-1", audit.length ? "bg-risk-critical/10 text-risk-critical" : "bg-risk-low/10 text-risk-low")}>
            <ShieldCheck size={12} /> {audit.length ? `${audit.length} policy-audit issue(s)` : "Policy audit: compliant"}
          </span>
        )}
        <span className="rounded-md bg-muted px-2 py-1 text-muted-foreground">{a.tool_calls} graph & retrieval calls · {a.latency_s}s</span>
      </div>
      <p className="leading-6">{c.summary}</p>
      {c.pattern_description && (
        <div className="rounded-lg border border-agent-challenger/30 bg-agent-challenger/5 p-3">
          <Label>Undocumented pattern (R9)</Label>
          <p className="mt-1 leading-6">{c.pattern_description}</p>
        </div>
      )}

      <div>
        <Label>Evidence ({c.evidence.length})</Label>
        <table className="mt-2 w-full text-left">
          <tbody>
            {c.evidence.map((e, i) => (
              <tr key={i} className="border-b border-border/60 align-top last:border-0">
                <td className="py-2 pr-3 leading-5">{e.claim}</td>
                <td className="w-[88px] py-2 pr-2">
                  <span className={cn("rounded px-1.5 py-0.5 text-[11px]", SRC[e.source] ?? SRC.external)}>{e.source}</span>
                </td>
                <td className="w-[210px] break-all py-2 font-mono text-[10.5px] text-subtle">{e.ref}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(c.affected_txn_ids.length > 0 || c.connected_card_ids.length > 0 || c.similar_prior_cases.length > 0) && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["Affected transactions", c.affected_txn_ids],
            ["Connected cards", c.connected_card_ids],
            ["Similar prior cases", c.similar_prior_cases],
          ].map(([k, ids]) => (
            <div key={k as string}>
              <Label>{k as string}</Label>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {(ids as string[]).length === 0 && <span className="text-subtle">—</span>}
                {(ids as string[]).slice(0, 12).map((x) => (
                  <span key={x} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{x}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <Label>Next best action — before → after evidence</Label>
        {a.evidence_requests.map((r, i) => (
          <div key={i} className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-[12.5px]">
            <span className="font-mono">{r.type}</span> (after step {r.asked_after_step}) — assumed reply: <i>{r.assumed_response}</i>
          </div>
        ))}
        <div className="mt-3 grid grid-cols-[1fr_24px_1fr] items-start gap-2">
          {[a.next_best_actions.initial, null, a.next_best_actions.final].map((list, i) =>
            list === null ? (
              <ArrowRight key={i} size={16} className="mt-3 text-subtle" />
            ) : (
              <div key={i} className="space-y-1.5">
                <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{i === 0 ? "Initial" : "Final"}</div>
                {list.map((x) => {
                  const changed = i === 0 ? !final.has(x.action) : !initial.has(x.action);
                  return (
                    <div key={x.action} className={cn("rounded-md border border-border px-2.5 py-2", changed && (i === 0 ? "opacity-60 line-through decoration-subtle" : "border-accent/50 bg-accent/5"))}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[12px]">{x.action}</span>
                        <RouteBadge route={x.route} />
                      </div>
                      <div className="mt-1 text-[11.5px] text-muted-foreground">{x.reason}</div>
                    </div>
                  );
                })}
              </div>
            ),
          )}
        </div>
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          <span className="text-foreground">What changed:</span> {a.next_best_actions.what_changed}
        </p>
      </div>

      <div>
        <Label>Suspicious activity report</Label>
        {a.sar.file ? (
          <div className="mt-2 rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2.5 text-[12px]">
              <span className="flex items-center gap-1 text-route-senior"><FileWarning size={13} /> File — needs L2 approval</span>
              <span className="text-muted-foreground">{fmtUsd(a.sar.total_amount_usd)} · {a.sar.activity_dates.join(" → ")}</span>
              <span className="text-muted-foreground">Subjects: <span className="font-mono">{a.sar.subjects.join(", ")}</span></span>
            </div>
            <div className="space-y-2 px-4 py-3 leading-6">
              {a.sar.narrative.split(/(?<=\.)\s+(?=[A-Z])/).map((sent, i) => (
                <p key={i}>{sent}</p>
              ))}
            </div>
            <div className="border-t border-border px-4 py-2 text-[12px] text-muted-foreground">{a.sar.reason}</div>
          </div>
        ) : (
          <p className="mt-2 flex items-center gap-1.5 text-muted-foreground"><Check size={13} className="text-risk-low" /> No report — {a.sar.reason}</p>
        )}
      </div>

      <div>
        <Label>Why the investigation stopped</Label>
        <p className="mt-1 leading-6">{a.stop_reason}</p>
      </div>
    </div>
  );
}
