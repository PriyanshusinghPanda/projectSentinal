"use client";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Check, CircleDashed, Database, Download, FileWarning, Loader2, Play, RotateCcw, Terminal, X } from "lucide-react";
import { CaseFileView } from "@/components/CaseFileView";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import type { FraudCase, AgentId, DecisionLogEntry, Dispute, Finding, InvestigationEvent, PastCase, Recommendation } from "@/lib/types";
import { Shell } from "@/components/Shell";
import { EntityGraph } from "@/components/EntityGraph";
import { Gauge } from "@/components/Gauge";
import { AGENTS, AgentAvatar, Card, Label, PanelHeader, RiskBadge, RouteBadge, StatusBadge, TRIGGER_LABEL, cn, fmtUsd } from "@/components/ui";

type TimelineItem =
  | { k: "status"; phase: string; message: string }
  | { k: "agent"; agent: AgentId; task: string; tools: string[]; findings: Finding[] }
  | { k: "dispute"; dispute: Dispute; target?: Finding };

type Tab = "timeline" | "evidence" | "sar" | "log" | "file";

export default function CasePage() {
  const { id } = useParams<{ id: string }>();
  const [c, setCase] = useState<FraudCase | null>(null);
  const [source, setSource] = useState<string>("");
  const [mode, setMode] = useState<string>("");
  const [loadError, setLoadError] = useState<string | null>(null);

  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [narr, setNarr] = useState<Record<string, string>>({});
  const [similar, setSimilar] = useState<(PastCase & { similarity: number })[]>([]);
  const [sar, setSar] = useState<{ required: boolean; draft?: string } | null>(null);
  const [log, setLog] = useState<DecisionLogEntry[]>([]);
  const [status, setStatus] = useState("new");
  const [running, setRunning] = useState(false);
  const [liveAgent, setLiveAgent] = useState<AgentId | null>(null);
  const [evidenceChoice, setEvidenceChoice] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<Record<string, "approved" | "rejected">>({});
  const [tab, setTab] = useState<Tab>("timeline");
  const [live, setLive] = useState<{ busy: boolean; msg: string | null; error?: boolean }>({ busy: false, msg: null });
  const [fileVersion, setFileVersion] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (evidence?: string) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setRunning(true);
      setTimeline([]);
      setFindings([]);
      setRecs([]);
      setSimilar([]);
      setSar(null);
      setLog([]);
      setApprovals({});
      setTab("timeline");
      const qs = new URLSearchParams({ caseId: id, ...(evidence ? { evidence, resume: "1" } : {}) });
      let res: Response;
      try {
        res = await fetch(`/api/investigate?${qs}`, { signal: ctrl.signal });
      } catch {
        return;
      }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      const findingById = new Map<string, Finding>();
      for (;;) {
        let chunk: ReadableStreamReadResult<Uint8Array>;
        try {
          chunk = await reader.read();
        } catch {
          return; // aborted by a newer run
        }
        if (ctrl.signal.aborted) return;
        const { value, done } = chunk;
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop()!;
        for (const line of lines) {
          if (!line.trim()) continue;
          const e = JSON.parse(line) as InvestigationEvent;
          handle(e, findingById);
        }
      }
      setRunning(false);
      setLiveAgent(null);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );

  function handle(e: InvestigationEvent, byId: Map<string, Finding>) {
    switch (e.type) {
      case "status":
        setTimeline((t) => [...t, { k: "status", phase: e.phase, message: e.message }]);
        break;
      case "agent_start":
        setLiveAgent(e.agent);
        setTimeline((t) => [...t, { k: "agent", agent: e.agent, task: e.task, tools: [], findings: [] }]);
        break;
      case "tool_call":
        setTimeline((t) => updateLastAgent(t, (a) => ({ ...a, tools: [...a.tools, `${e.tool} › ${e.query}`] })));
        break;
      case "finding":
        byId.set(e.finding.id, e.finding);
        setFindings((f) => [...f, e.finding]);
        setTimeline((t) => updateLastAgent(t, (a) => ({ ...a, findings: [...a.findings, e.finding] })));
        break;
      case "similar_cases":
        setSimilar(e.cases);
        break;
      case "dispute":
        setTimeline((t) => [...t, { k: "dispute", dispute: e.dispute, target: byId.get(e.dispute.targetFindingId) }]);
        break;
      case "recommendation":
        setRecs((r) => [...r, e.recommendation]);
        break;
      case "narrative":
        setNarr((n) => ({ ...n, [e.stage]: e.text }));
        break;
      case "sar":
        setSar({ required: e.required, draft: e.draft });
        break;
      case "log":
        setLog((l) => [...l, e.entry]);
        break;
      case "done":
        setStatus(e.caseStatus);
        break;
    }
  }

  useEffect(() => {
    fetch(`/api/case/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) return setLoadError(d.error);
        setCase(d.case);
        setSource(d.source);
        setMode(d.mode);
      })
      .catch((e) => setLoadError(String(e)));
  }, [id]);

  useEffect(() => {
    if (!c) return;
    run();
    return () => abortRef.current?.abort();
  }, [run, c]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [timeline]);

  const pre = recs.find((r) => r.stage === "pre_evidence");
  const post = recs.find((r) => r.stage === "post_evidence");
  const current = post ?? pre;

  if (!c)
    return (
      <Shell crumbs={<span className="font-mono">{id}</span>}>
        <div className="grid min-h-[60vh] place-items-center text-center">
          {loadError ? (
            <div>
              <div className="font-mono text-xs text-risk-critical">case not found</div>
              <div className="mt-2 text-[20px] font-semibold tracking-[-0.02em]">No case {id}</div>
              <Link href="/cases" className="mt-4 inline-grid h-9 place-items-center rounded-full border border-border px-5 text-[13px] hover:bg-elevated">Back to the queue</Link>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <span className="size-2 animate-ping rounded-full bg-accent" /> Loading case…
            </div>
          )}
        </div>
      </Shell>
    );
  const subject = c.transactions.find((t) => t.id === c.subjectTxnId) ?? c.transactions[c.transactions.length - 1];

  async function decide(label: string, route: string, decision: "approved" | "rejected") {
    if (!c) return;
    setApprovals((a) => ({ ...a, [label]: decision }));
    const r = await fetch("/api/approve", { method: "POST", body: JSON.stringify({ caseId: c.id, actionLabel: label, route, decision }) });
    const { entry } = await r.json();
    setLog((l) => [...l, entry]);
  }

  async function runLive() {
    setLive({ busy: true, msg: null });
    const r = await fetch("/api/agent/investigate", { method: "POST", body: JSON.stringify({ case_id: id }) });
    const d = await r.json();
    if (!r.ok) {
      setLive({ busy: false, msg: d.error ?? "Live run failed", error: true });
      return;
    }
    setLive({ busy: false, msg: `Live run on TigerGraph: ${d.seconds}s · ${d.mcp_calls} MCP calls · written to the graph as ${d.graph_case_id}` });
    setFileVersion((v) => v + 1);
    setEvidenceChoice(null);
    setNarr({});
    run();
  }

  function exportAnswer() {
    if (!c) return;
    if (mode === "dataset") {
      window.location.href = `/api/answer/${c.id}?reply=${evidenceChoice ?? "agent"}`;
      return;
    }
    const answer = {
      case_id: c.id,
      trigger: { type: c.trigger, detail: c.triggerDetail },
      subject_transaction: subject,
      investigation_record: { findings, similar_cases: similar.map(({ id, outcome, similarity }) => ({ id, outcome, similarity })) },
      next_best_action_before_evidence: pre && { assessment: pre.assessment, actions: pre.actions, evidence_requested: pre.evidenceRequest, explanation: narr.pre_evidence ?? pre.explanation },
      evidence_received: evidenceChoice && c.evidenceOutcomes.find((o) => o.id === evidenceChoice),
      next_best_action_after_evidence: post && { assessment: post.assessment, actions: post.actions, explanation: narr.post_evidence ?? post.explanation },
      sar,
      approvals,
      decision_log: log,
      status,
    };
    const url = URL.createObjectURL(new Blob([JSON.stringify(answer, null, 2)], { type: "application/json" }));
    Object.assign(document.createElement("a"), { href: url, download: `${c.id}.answer.json` }).click();
  }

  return (
    <Shell source={source} crumbs={<><Link href="/cases" className="hover:text-foreground">Cases</Link><span className="text-subtle">/</span><span className="font-mono text-foreground">{c.id}</span></>}>
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
            {current && <RiskBadge band={current.assessment.band} score={current.assessment.riskScore} />}
            <StatusBadge status={running ? "investigating" : status} />
            {current?.assessment.pattern && (
              <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px]">
                <span className="font-mono text-muted-foreground">{current.assessment.pattern.id}</span> {current.assessment.pattern.name}
              </span>
            )}
          </div>
          <h1 className="text-[22px] font-semibold leading-7 tracking-[-0.02em]">{c.title}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
            <span>{c.customer.id}{c.customer.segment !== "—" && ` · ${c.customer.segment}`}{c.customer.tenureMonths > 0 && ` · ${c.customer.tenureMonths} mo tenure`}</span>
            <span>Subject <span className="font-mono text-foreground">{c.subjectTxnId}</span> · <span className="font-mono text-foreground">{fmtUsd(subject.amount)}</span></span>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setEvidenceChoice(null); setNarr({}); run(); }} disabled={running} className="flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-[13px] hover:bg-elevated disabled:opacity-50">
            <RotateCcw size={13} /> Replay
          </button>
          {mode === "dataset" && (
            <button onClick={runLive} disabled={running || live.busy} title="Re-run the real agent now: graph queries and write-back through TigerGraph MCP" className="flex h-8 items-center gap-1.5 rounded-md border border-accent/40 px-3 text-[13px] text-accent hover:bg-accent/5 disabled:opacity-50">
              {live.busy ? <Loader2 size={13} className="animate-spin" /> : <Database size={13} />} {live.busy ? "Investigating on TigerGraph…" : "Run live on TigerGraph"}
            </button>
          )}
          <button onClick={exportAnswer} disabled={running || !pre} className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
            <Download size={13} /> Export answer
          </button>
        </div>
      </div>

      {live.msg && (
        <div className={cn("mb-4 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-[13px]", live.error ? "border-risk-critical/40 bg-risk-critical/5 text-risk-critical" : "border-risk-low/40 bg-risk-low/5 text-risk-low")}>
          {live.error ? <X size={14} /> : <Check size={14} />} {live.msg}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* LEFT */}
        <div className="space-y-4 xl:col-span-3">
          <Card>
            <PanelHeader title="Trigger" right={<span className="text-xs font-normal text-muted-foreground">{TRIGGER_LABEL[c.trigger]}</span>} />
            <div className="p-4 text-[13px]">{c.triggerDetail}</div>
          </Card>

          <Card>
            <PanelHeader title="Transactions" right={<span className="font-mono text-xs font-normal text-muted-foreground">{c.transactions.length}</span>} />
            <div>
              {c.transactions.map((t) => (
                <div key={t.id} className={cn("flex h-10 items-center gap-3 border-b border-border/60 px-4 last:border-0", t.subject && "bg-elevated")}>
                  <span className="w-14 font-mono text-[11px] text-subtle">{t.ts}</span>
                  <span className="min-w-0 flex-1 truncate text-xs">{t.merchant}</span>
                  <span className="font-mono text-xs tabular-nums">{fmtUsd(t.amount)}</span>
                  <span className={cn("w-8 text-right font-mono text-[11px] tabular-nums", t.riskScore >= 0.7 ? "text-risk-critical" : t.riskScore >= 0.5 ? "text-risk-high" : "text-muted-foreground")}>
                    {t.riskScore.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <EvidencePanel
            pre={pre}
            post={post}
            running={running}
            outcomes={c.evidenceOutcomes}
            chosen={evidenceChoice}
            onChoose={(o) => { setEvidenceChoice(o); run(o); }}
          />
        </div>

        {/* CENTER */}
        <div className="space-y-4 xl:col-span-6">
          <Card className="overflow-hidden">
            <PanelHeader title="Entity graph" right={<span className="font-mono text-[11px] font-normal text-muted-foreground">{source} · case_context · {c.nodes.length} vertices · {c.edges.length} edges</span>} />
            <EntityGraph nodes={c.nodes} edges={c.edges} height={330} />
          </Card>

          <Card className="flex flex-col">
            <div className="flex h-11 items-center gap-1 border-b border-border px-2">
              {((mode === "dataset" ? ["timeline", "evidence", "file", "sar", "log"] : ["timeline", "evidence", "sar", "log"]) as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={cn("h-7 rounded-md px-3 text-[13px] capitalize text-muted-foreground hover:text-foreground", tab === t && "bg-elevated text-foreground")}>
                  {t === "sar" ? "SAR" : t === "timeline" ? "Agent timeline" : t === "evidence" ? `Findings (${findings.length})` : t === "file" ? "Case file" : `Decision log (${log.length})`}
                </button>
              ))}
              {running && (
                <span className="ml-auto flex items-center gap-1.5 pr-2 text-xs text-muted-foreground">
                  <Loader2 size={12} className="animate-spin" /> {liveAgent ? AGENTS[liveAgent].name : "Running"}
                </span>
              )}
            </div>
            <div ref={scroller} className="h-[520px] overflow-y-auto p-4">
              {tab === "timeline" && <Timeline items={timeline} live={running ? liveAgent : null} />}
              {tab === "evidence" && <FindingsTable findings={findings} />}
              {tab === "sar" && <SarView sar={sar} />}
              {tab === "log" && <LogView log={log} />}
              {tab === "file" && <CaseFileView id={id} reply={evidenceChoice ?? "agent"} version={fileVersion} />}
            </div>
          </Card>
        </div>

        {/* RIGHT */}
        <div className="space-y-4 xl:col-span-3">
          <Card className={cn("py-5", current?.assessment.band === "critical" && "border-risk-critical/40")}>
            <Gauge a={current?.assessment ?? null} prev={post ? pre?.assessment : null} />
            {current && (
              <div className="mt-4 flex justify-center">
                <span className={cn("rounded-md px-2 py-1 text-[11px] font-medium", current.assessment.enoughEvidence ? "bg-risk-low/10 text-risk-low" : "bg-risk-medium/10 text-risk-medium")}>
                  {current.assessment.enoughEvidence ? "Enough evidence to act" : "Uncertain — more evidence needed"}
                </span>
              </div>
            )}
          </Card>

          <Card>
            <PanelHeader title="Next best action" right={current && <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-subtle">{post ? "After evidence" : "Before evidence"}</span>} />
            <div className="space-y-2 p-3">
              {!current && <Skeleton />}
              <AnimatePresence mode="popLayout">
                {current?.actions.map((a, i) => (
                  <motion.div
                    key={current.stage + a.label}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.06 }}
                    className={cn("rounded-xl border border-border bg-card p-3", i === 0 && "border-accent/50 bg-accent/5")}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-[13px] font-medium">{a.label}</div>
                      <RouteBadge route={a.approval} />
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{a.rationale}</div>
                    <div className="mt-1 text-[11px] text-subtle">{a.policyRef}</div>
                    <ApprovalControl
                      state={approvals[a.label]}
                      route={a.approval}
                      disabled={running}
                      onDecide={(d) => decide(a.label, a.approval, d)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
              {pre && post && (
                <details className="rounded-lg border border-dashed border-border p-2.5 text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Before evidence ({pre.actions.length} actions)</summary>
                  <ul className="mt-2 space-y-1">
                    {pre.actions.map((a) => (
                      <li key={a.id} className="flex justify-between gap-2"><span>{a.label}</span><RouteBadge route={a.approval} /></li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </Card>

          {current && (
            <Card>
              <PanelHeader title="Why" right={<span className="text-[11px] font-normal text-muted-foreground">{narr[current.stage] ? "Claude · grounded" : "Deterministic"}</span>} />
              <p className="p-4 text-[13px] leading-5 text-foreground/90">{narr[current.stage] ?? current.explanation}</p>
            </Card>
          )}

          <Card>
            <PanelHeader title="Similar past cases" right={<AgentAvatar id="memory" size={20} />} />
            <div className="divide-y divide-border/60">
              {similar.length === 0 && <div className="p-4 text-xs text-muted-foreground">{running ? "Searching case memory…" : "No close precedent."}</div>}
              {similar.map((s) => (
                <div key={s.id} className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs">{s.id}</span>
                    <span className="flex items-center gap-2">
                      <span className={cn("text-[11px]", s.outcome === "confirmed_fraud" ? "text-risk-critical" : "text-risk-low")}>{s.outcome.replace("_", " ")}</span>
                      <span className="font-mono text-xs tabular-nums text-confidence">{Math.round(s.similarity * 100)}%</span>
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.summary}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}

function updateLastAgent(t: TimelineItem[], fn: (a: Extract<TimelineItem, { k: "agent" }>) => TimelineItem): TimelineItem[] {
  for (let i = t.length - 1; i >= 0; i--) {
    const it = t[i];
    if (it.k === "agent") return [...t.slice(0, i), fn(it), ...t.slice(i + 1)];
  }
  return t;
}

function Timeline({ items, live }: { items: TimelineItem[]; live: AgentId | null }) {
  if (!items.length) return <Skeleton />;
  return (
    <div>
      {items.map((it, i) => {
        const last = i === items.length - 1;
        if (it.k === "status")
          return (
            <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.08em] text-subtle">
              <span className="h-px flex-1 bg-border" />
              <span className="font-mono">{it.phase.replace("_", " ")}</span> · <span className="normal-case tracking-normal">{it.message}</span>
              <span className="h-px flex-1 bg-border" />
            </motion.div>
          );
        if (it.k === "dispute")
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="relative mb-4 pl-8">
              <span className="absolute left-0 top-0.5"><AgentAvatar id="challenger" /></span>
              <div className="rounded-lg border border-agent-challenger/35 bg-agent-challenger/[0.06] p-3 text-[13px]">
                <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-agent-challenger">
                  Disputes {it.target ? AGENTS[it.target.agent].name : "finding"}
                </div>
                {it.target && <div className="mb-1.5 border-l border-border pl-2 text-muted-foreground line-through decoration-agent-challenger/50">{it.target.title}</div>}
                <div>{it.dispute.argument}</div>
                <div className="mt-2 flex items-center gap-2 text-xs text-agent-orchestrator">
                  {it.dispute.upheld ? <Check size={12} /> : <X size={12} />}
                  Orchestrator: {it.dispute.upheld ? "upheld — weight discounted" : "overruled — finding stands"}
                </div>
              </div>
            </motion.div>
          );
        const a = AGENTS[it.agent];
        const isLive = last && live === it.agent;
        return (
          <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="relative mb-4 pl-8" style={{ ["--agent" as string]: `var(${a.var})` }}>
            {!last && <span className="absolute bottom-[-12px] left-[11px] top-7 w-px bg-border" />}
            <span className="absolute left-0 top-0.5"><AgentAvatar id={it.agent} /></span>
            <div className="mb-1 flex items-center gap-2 text-xs">
              <span className={cn("font-medium", a.text)}>{a.name}</span>
              <span className="text-muted-foreground">{it.task}</span>
              {isLive && <Loader2 size={11} className="animate-spin text-muted-foreground" />}
            </div>
            {it.tools.map((t, j) => (
              <div key={j} className="mb-1.5 flex items-start gap-1.5 rounded-md bg-muted/60 px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
                <Terminal size={11} className="mt-0.5 shrink-0" /> {t}
              </div>
            ))}
            {it.findings.map((f) => <FindingCard key={f.id} f={f} />)}
          </motion.div>
        );
      })}
    </div>
  );
}

function FindingCard({ f }: { f: Finding }) {
  const dir = f.logOdds > 0.05 ? "up" : f.logOdds < -0.05 ? "down" : "flat";
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="relative mb-1.5 rounded-lg border border-border bg-card py-2 pl-4 pr-3 before:absolute before:bottom-2 before:left-0 before:top-2 before:w-[2px] before:rounded-full before:bg-[hsl(var(--agent))]" style={{ ["--agent" as string]: `var(${AGENTS[f.agent].var})` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="text-[13px] font-medium">{f.title}</div>
        <span className={cn("shrink-0 font-mono text-[11px] tabular-nums", dir === "up" ? "text-risk-critical" : dir === "down" ? "text-risk-low" : "text-muted-foreground")}>
          {dir === "up" ? "▲" : dir === "down" ? "▼" : "●"} {f.logOdds > 0 ? "+" : ""}{f.logOdds.toFixed(2)}
        </span>
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{f.detail}</div>
      <div className="mt-1 font-mono text-[10px] text-subtle">{f.source} · conf {Math.round(f.confidence * 100)}%</div>
    </motion.div>
  );
}

function EvidencePanel({ pre, post, running, outcomes, chosen, onChoose }: { pre?: Recommendation; post?: Recommendation; running: boolean; outcomes: { id: string; label: string; description: string }[]; chosen: string | null; onChoose: (id: string) => void }) {
  const req = pre?.evidenceRequest;
  return (
    <Card className={cn(req && !post && !running && "border-risk-medium/40")}>
      <PanelHeader title="Additional evidence" right={req && <span className="font-mono text-[11px] font-normal text-muted-foreground">gain {req.expectedGain.toFixed(2)}</span>} />
      <div className="p-4">
        {!pre && <div className="text-xs text-muted-foreground">Waiting for assessment…</div>}
        {pre && !req && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Check size={14} className="mt-0.5 shrink-0 text-risk-low" />
            Confidence meets policy threshold. The agent stopped investigating — no further evidence needed.
          </div>
        )}
        {req && (
          <>
            <div className="mb-1 text-[13px] font-medium">{req.label}</div>
            <div className="mb-3 text-xs text-muted-foreground">{req.why}</div>
            <Label className="mb-2">{post ? "Evidence received" : "Simulate response"}</Label>
            <div className="space-y-1.5">
              {outcomes.map((o) => (
                <button
                  key={o.id}
                  disabled={running}
                  onClick={() => onChoose(o.id)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-lg border border-border p-2.5 text-left transition-colors hover:bg-elevated disabled:opacity-60",
                    chosen === o.id && "border-accent/60 bg-accent/5",
                  )}
                >
                  {chosen === o.id ? <Check size={13} className="mt-0.5 shrink-0 text-accent" /> : running ? <CircleDashed size={13} className="mt-0.5 shrink-0 text-subtle" /> : <Play size={13} className="mt-0.5 shrink-0 text-muted-foreground" />}
                  <span>
                    <span className="block text-[13px]">{o.label}</span>
                    <span className="block text-[11px] text-muted-foreground">{o.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

function ApprovalControl({ state, route, disabled, onDecide }: { state?: "approved" | "rejected"; route: string; disabled: boolean; onDecide: (d: "approved" | "rejected") => void }) {
  if (route === "auto")
    return <div className="mt-2 flex items-center gap-1 text-[11px] text-route-auto"><Check size={11} /> Executed within agent permissions (simulated)</div>;
  if (state)
    return <div className={cn("mt-2 flex items-center gap-1 text-[11px]", state === "approved" ? "text-risk-low" : "text-risk-critical")}>{state === "approved" ? <Check size={11} /> : <X size={11} />} {state === "approved" ? "Approved" : "Rejected"} by analyst</div>;
  return (
    <div className="mt-2.5 flex gap-1.5">
      <button disabled={disabled} onClick={() => onDecide("approved")} className="flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
        Approve <ArrowRight size={11} />
      </button>
      <button disabled={disabled} onClick={() => onDecide("rejected")} className="h-7 rounded-md border border-border px-2.5 text-xs hover:bg-elevated disabled:opacity-50">
        Reject
      </button>
    </div>
  );
}

function FindingsTable({ findings }: { findings: Finding[] }) {
  const sorted = useMemo(() => [...findings].sort((a, b) => Math.abs(b.logOdds * b.confidence) - Math.abs(a.logOdds * a.confidence)), [findings]);
  const max = Math.max(0.1, ...sorted.map((f) => Math.abs(f.logOdds * f.confidence)));
  return (
    <div className="space-y-2">
      <Label className="mb-2">Risk drivers — weighted log-odds contribution</Label>
      {sorted.map((f) => {
        const v = f.logOdds * f.confidence;
        return (
          <div key={f.id} className="flex items-center gap-3">
            <AgentAvatar id={f.agent} size={20} />
            <div className="w-[45%] truncate text-xs">{f.title}</div>
            <div className="relative h-2 flex-1 rounded-full bg-muted">
              <div className="absolute left-1/2 top-0 h-2 w-px bg-border" />
              <div className={cn("absolute top-0 h-2 rounded-full", v >= 0 ? "left-1/2 bg-risk-critical/80" : "right-1/2 bg-risk-low/80")} style={{ width: `${(Math.abs(v) / max) * 50}%` }} />
            </div>
            <span className="w-12 text-right font-mono text-[11px] tabular-nums text-muted-foreground">{v > 0 ? "+" : ""}{v.toFixed(2)}</span>
          </div>
        );
      })}
    </div>
  );
}

function SarView({ sar }: { sar: { required: boolean; draft?: string } | null }) {
  if (!sar) return <div className="text-xs text-muted-foreground">SAR determination is made once the investigation reaches a decision.</div>;
  if (!sar.required)
    return <div className="flex items-center gap-2 text-[13px] text-muted-foreground"><Check size={14} className="text-risk-low" /> SAR not required under Fraud Policy §6.2 for this outcome.</div>;
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-[13px] text-route-senior"><FileWarning size={14} /> SAR required — needs fraud-manager (L2) approval before filing</div>
      <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 font-mono text-[12px] leading-5 text-foreground/90">{sar.draft}</pre>
    </div>
  );
}

function LogView({ log }: { log: DecisionLogEntry[] }) {
  return (
    <div className="font-mono text-[12px]">
      {log.map((l, i) => (
        <div key={i} className="flex gap-3 border-b border-border/50 py-1.5">
          <span className="shrink-0 text-subtle">{new Date(l.ts).toLocaleTimeString()}</span>
          <span className="w-24 shrink-0 text-muted-foreground">{l.actor}</span>
          <span className="text-foreground/90">{l.entry}</span>
        </div>
      ))}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/60" />
      ))}
    </div>
  );
}
