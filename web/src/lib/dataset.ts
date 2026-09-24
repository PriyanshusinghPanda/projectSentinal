import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Action, AgentId, Assessment, EvidenceOutcome, FraudCase, InvestigationEvent, PastCase, Recommendation } from "./types";

/**
 * Real HHGOA_IEEE mode. agent/investigate.py writes one bundle per exam case to web/case_bundles/:
 * the graded answer under each simulated customer reply ("agent" = the agent's own assumption, "deny", "confirm")
 * plus the transaction window and graph neighbourhood. This module replays that investigation as the same event
 * stream the console renders, so the UI shows exactly what is in the submitted answer files.
 */
export const BUNDLE_DIR = process.env.SENTINEL_BUNDLES ?? path.join(process.cwd(), "case_bundles");
export const datasetAvailable = existsSync(BUNDLE_DIR) && readdirSync(BUNDLE_DIR).some((f) => f.endsWith(".json"));

type Act = { action: string; route: "auto" | "L1" | "L2"; reason: string };
interface Answer {
  case_id: string;
  case: {
    status: string;
    verdict: string;
    fraud_probability: number;
    pattern: string;
    pattern_description: string;
    affected_txn_ids: string[];
    connected_card_ids: string[];
    connected_device_profiles: string[];
    exposure_usd: number;
    evidence: { claim: string; source: string; ref: string; entity_ids: string[] }[];
    similar_prior_cases: string[];
    summary: string;
  };
  evidence_requests: { type: string; asked_after_step: number; assumed_response: string }[];
  next_best_actions: { initial: Act[]; final: Act[]; what_changed: string };
  sar: { file: boolean; reason: string; narrative: string; total_amount_usd: number };
  stop_reason: string;
}
interface Bundle {
  context: {
    opened_at: string;
    trigger_type: FraudCase["trigger"];
    trigger_text: string;
    flagged_txn_id: string;
    card_id: string;
    customer_id: string;
    risk_score: number;
    amount: number;
    channel: string;
    initial_probability: number;
    transactions: { id: string; ts: string; amount: number; product: string; channel: string; region: string; risk: number; device_new: boolean; subject: boolean; affected: boolean }[];
    nodes: FraudCase["nodes"];
    edges: FraudCase["edges"];
    similar: { id: string; outcome: string; pattern: string; notes: string; why?: string }[];
  };
  variants: Record<"agent" | "deny" | "confirm", Answer>;
}

export const PATTERN_NAMES: Record<string, string> = {
  card_testing: "Card testing",
  card_not_present_fraud: "Card-not-present fraud",
  card_not_present_new_device: "CNP from a new device",
  out_of_region_use: "Out-of-region use",
  account_takeover: "Account takeover",
  undocumented: "Undocumented pattern",
  none: "No fraud pattern",
};

const cache = new Map<string, Bundle>();
/** Drop a cached bundle after the live agent rewrites it. */
export function invalidate(id: string) {
  cache.delete(id);
}
export function bundle(id: string): Bundle {
  if (!cache.has(id)) {
    const file = path.join(BUNDLE_DIR, `${id}.json`);
    if (!existsSync(file)) throw new Error(`case ${id} not found`);
    cache.set(id, JSON.parse(readFileSync(file, "utf8")));
  }
  return cache.get(id)!;
}

export function caseIds() {
  return readdirSync(BUNDLE_DIR).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")).sort();
}

const band = (p: number): Assessment["band"] => (p >= 0.85 ? "critical" : p >= 0.6 ? "high" : p >= 0.3 ? "medium" : "low");

function assessment(a: Answer, p: number, settled: boolean): Assessment {
  return {
    riskScore: p,
    confidence: settled ? (p >= 0.85 || p <= 0.15 ? 0.92 : 0.7) : 0.55,
    pattern: a.case.pattern !== "none" ? { id: a.case.pattern, name: PATTERN_NAMES[a.case.pattern] ?? a.case.pattern, match: 1 } : null,
    band: band(p),
    enoughEvidence: settled,
  };
}

const actions = (list: Act[], stage: string): Action[] =>
  list.map((x, i) => ({ id: `${stage}-${i}`, kind: x.action, label: x.action, approval: x.route, rationale: x.reason, policyRef: (x.reason.match(/R\d+|3a|3b|policy \d/g) ?? []).join(", ") || "Fraud Policy v1.0" }));

/** A readable title instead of the raw trigger text. */
export function titleOf(c: Bundle["context"]) {
  const amt = "$" + c.amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const ch = c.channel === "online" ? "online purchase" : "in-person purchase";
  const region = c.transactions.find((t) => t.subject)?.region;
  if (c.trigger_type === "customer_report") return `Customer dispute · ${amt} ${ch}`;
  if (c.trigger_type === "analyst_request") return `Analyst request · shared device across several cards`;
  return `Model alert · score ${c.risk_score.toFixed(2)} on a ${amt} ${ch}${c.channel !== "online" && region ? ` in region ${region.replace(".0", "")}` : ""}`;
}

export function toCase(id: string): FraudCase {
  const b = bundle(id);
  const c = b.context;
  const agent = b.variants.agent;
  const outcomes: EvidenceOutcome[] = agent.evidence_requests.length || b.variants.deny.evidence_requests.length
    ? [
        { id: "agent", label: "Agent's assumption", description: agent.evidence_requests.map((e) => e.assumed_response).join(" · ") || "No evidence needed", logOddsShift: 0, resolves: true },
        { id: "deny", label: "Customer denies", description: b.variants.deny.evidence_requests[0]?.assumed_response ?? "Customer did not make the purchase", logOddsShift: 0, resolves: true },
        { id: "confirm", label: "Customer confirms", description: b.variants.confirm.evidence_requests[0]?.assumed_response ?? "Customer made the purchase", logOddsShift: 0, resolves: true },
      ]
    : [];
  return {
    id,
    title: titleOf(c),
    trigger: c.trigger_type,
    triggerDetail: c.trigger_text,
    openedAt: c.opened_at,
    customer: { id: c.customer_id, name: c.card_id, tenureMonths: 0, segment: c.card_id },
    subjectTxnId: c.flagged_txn_id,
    transactions: c.transactions.map((t) => ({ id: t.id, ts: t.ts, amount: t.amount, productCD: t.product as FraudCase["transactions"][number]["productCD"], merchant: `Product ${t.product}`, riskScore: t.risk, subject: t.subject, channel: t.channel as "online" | "in_person", region: t.region ? t.region.replace(".0", "") : "", deviceNew: t.device_new })),
    nodes: c.nodes,
    edges: c.edges,
    signals: { velocity1h: 0, smallAuthsBeforeLarge: 0, amountZ: 0, newDevice: false, deviceAgeDays: 0, cardsOnDevice: 0, cardsOnIp: 0, emailDomainMismatch: false, addrChanged7d: false, hopsToConfirmedFraud: null, communitySize: 0 },
    evidenceOutcomes: outcomes,
  };
}

export function summary(id: string) {
  const b = bundle(id);
  const a = b.variants.agent;
  const final = a.next_best_actions.final;
  const lead = final.find((x) => x.route === "L2") ?? final.find((x) => x.route === "L1") ?? final[0];
  const ctx = b.context;
  const region = ctx.transactions.find((t) => t.subject)?.region?.replace(".0", "");
  const where = ctx.channel === "online" ? "online purchase" : `in-person purchase${region ? `, region ${region}` : ""}`;
  const place = where.charAt(0).toUpperCase() + where.slice(1);
  const short = ctx.trigger_type === "analyst_request" ? "Shared device across several cards" : ctx.trigger_type === "risk_score" ? `${place} · model ${ctx.risk_score.toFixed(2)}` : place;
  return {
    id,
    title: titleOf(b.context),
    short,
    pattern: PATTERN_NAMES[a.case.pattern] ?? a.case.pattern,
    nextAction: lead ? { action: lead.action, route: lead.route } : null,
    pendingApprovals: final.filter((x) => x.route !== "auto").length,
    probability: a.case.fraud_probability,
    triggerText: b.context.trigger_text,
    trigger: b.context.trigger_type,
    customer: { id: b.context.customer_id, segment: b.context.card_id },
    amount: b.context.amount,
    openedAt: b.context.opened_at,
    status: a.case.status,
    verdict: a.case.verdict,
    needsEvidence: a.evidence_requests.length > 0,
    sar: a.sar.file,
    exposure: a.case.exposure_usd,
    assessment: assessment(a, a.case.fraud_probability, true),
  };
}

function agentFor(e: Answer["case"]["evidence"][number]): AgentId {
  if (e.claim.startsWith("Challenger:")) return "challenger";
  if (e.ref.startsWith("closed_case") || e.ref === "closed_cases_history") return "memory";
  if (e.ref.includes("device_neighbors") || e.ref.includes("region_history")) return "graph";
  if (e.ref.includes("device_history")) return "device";
  if (e.ref.startsWith("trigger") || e.source === "customer") return "orchestrator";
  return "txn";
}

const TOOL: Record<AgentId, string> = {
  graph: "TigerGraph · device / region neighbourhood",
  txn: "TigerGraph · card transaction window",
  device: "TigerGraph · identity record",
  memory: "GraphRAG · closed_cases_history",
  policy: "GraphRAG · Fraud Policy v1.0",
  challenger: "",
  orchestrator: "",
};

export function* replay(id: string, reply?: "agent" | "deny" | "confirm"): Generator<InvestigationEvent> {
  const b = bundle(id);
  const c = b.context;
  const agent = b.variants.agent;
  const now = () => new Date().toISOString();
  let n = 0;
  const fid = (p: string) => `${p}-${++n}`;

  yield { type: "status", phase: "trigger", message: `${id} opened · ${c.trigger_type.replace("_", " ")} on ${c.flagged_txn_id} (${c.card_id})` };
  yield { type: "log", entry: { ts: now(), actor: "system", entry: `Alert received: ${c.trigger_text}` } };
  yield { type: "agent_start", agent: "orchestrator", task: "Plan investigation and dispatch specialists" };
  yield { type: "status", phase: "investigate", message: "Specialists query the graph and case memory" };

  const ev = agent.case.evidence;
  const order: AgentId[] = ["txn", "device", "graph", "memory"];
  for (const who of order) {
    const items = ev.filter((e) => agentFor(e) === who);
    if (!items.length) continue;
    yield { type: "agent_start", agent: who, task: { txn: "Profile the card's transaction window", device: "Check the identity record and device", graph: "Traverse shared devices / regions across customers", memory: "Retrieve similar closed cases", policy: "", challenger: "", orchestrator: "" }[who] };
    for (const e of items) {
      yield { type: "tool_call", agent: who, tool: TOOL[who], query: e.ref };
      const neg = /fits this card|cleared|legitimate/i.test(e.claim);
      yield {
        type: "finding",
        finding: { id: fid(who[0].toUpperCase()), agent: who, title: e.claim.length > 120 ? e.claim.slice(0, 117) + "…" : e.claim, detail: e.entity_ids.length ? `Entities: ${e.entity_ids.slice(0, 8).join(", ")}${e.entity_ids.length > 8 ? "…" : ""}` : "", logOdds: neg ? -1 : who === "memory" ? 0 : 1, confidence: 0.8, source: `${e.source} · ${e.ref}` },
      };
    }
    if (who === "memory") yield { type: "similar_cases", cases: c.similar.map((s) => ({ id: s.id, closedAt: "", pattern: s.pattern, outcome: s.outcome as PastCase["outcome"], summary: s.notes, features: {}, analystDecision: "", why: s.why, similarity: Number(s.why?.match(/([0-9.]+)$/)?.[1] ?? 0) })) };
  }

  yield { type: "agent_start", agent: "policy", task: "Apply Fraud Policy v1.0 (R1–R10, approval routes)" };
  yield { type: "tool_call", agent: "policy", tool: TOOL.policy, query: "sections 1–6: actions, routing, rules, case vs report, stopping" };
  const rules = Array.from(new Set(agent.next_best_actions.initial.concat(agent.next_best_actions.final).flatMap((a) => a.reason.match(/R\d+/g) ?? [])));
  yield { type: "finding", finding: { id: fid("P"), agent: "policy", title: `Rules in play: ${rules.join(", ") || "policy 0 / 6"}`, detail: agent.sar.reason, logOdds: 0, confidence: 1, source: "document · README Fraud Policy" } };
  if (agent.case.pattern === "undocumented")
    yield { type: "finding", finding: { id: fid("P"), agent: "policy", title: "Fits none of the five documented patterns (R9)", detail: agent.case.pattern_description, logOdds: 1, confidence: 0.9, source: "document · known fraud patterns" } };

  const challenges = ev.filter((e) => agentFor(e) === "challenger");
  yield { type: "status", phase: "challenge", message: "Challenger looks for benign explanations" };
  yield { type: "agent_start", agent: "challenger", task: "Argue the innocent explanation" };
  const firstFinding = { id: "P-1" };
  for (const ch of challenges)
    yield { type: "dispute", dispute: { id: fid("X"), targetFindingId: firstFinding.id, argument: ch.claim.replace(/^Challenger:\s*/, ""), adjustedLogOdds: 0, upheld: true } };
  if (!challenges.length) yield { type: "log", entry: { ts: now(), actor: "challenger", entry: "No credible benign explanation found" } };

  yield { type: "status", phase: "assess", message: "Orchestrator assesses probability and whether evidence is needed" };
  yield { type: "agent_start", agent: "orchestrator", task: "Decide: act now or gather evidence" };
  const needsEvidence = agent.evidence_requests.length > 0 || b.variants.deny.evidence_requests.length > 0;
  const pre: Recommendation = {
    stage: "pre_evidence",
    assessment: { ...assessment(agent, c.initial_probability, !needsEvidence), pattern: agent.case.pattern !== "none" ? { id: agent.case.pattern, name: PATTERN_NAMES[agent.case.pattern], match: 1 } : null },
    actions: actions(agent.next_best_actions.initial, "init"),
    evidenceRequest: needsEvidence
      ? { kind: (agent.evidence_requests[0]?.type ?? b.variants.deny.evidence_requests[0]?.type) === "step_up_auth" ? "step_up_auth" : "customer_confirmation", label: `Request ${(agent.evidence_requests[0]?.type ?? b.variants.deny.evidence_requests[0]?.type ?? "customer_validation").replace(/_/g, " ").replace("auth", "authentication")}`, why: "R1 / 3b: the policy requires verification before acting on this evidence", expectedGain: 0.5 }
      : undefined,
    explanation: needsEvidence ? `Initial probability ${c.initial_probability.toFixed(2)}. ${agent.next_best_actions.initial.map((a) => `${a.action} — ${a.reason}`).join(". ")}.` : `${agent.case.summary} Stop: ${agent.stop_reason}`,
  };
  yield { type: "recommendation", recommendation: pre };
  yield { type: "log", entry: { ts: now(), actor: "orchestrator", entry: `Initial NBA: ${agent.next_best_actions.initial.map((a) => `${a.action} [${a.route}]`).join(", ")}` } };

  let final = agent;
  if (needsEvidence) {
    if (!reply) {
      yield { type: "status", phase: "awaiting_evidence", message: "Awaiting the customer's reply (simulated — choose one)" };
      yield { type: "done", caseStatus: "awaiting_evidence" };
      return;
    }
    final = b.variants[reply];
    const resp = final.evidence_requests.map((e) => `${e.type}: ${e.assumed_response}`).join(" · ");
    yield { type: "status", phase: "evidence", message: `Evidence received (simulated): ${reply === "agent" ? "agent's assumption" : reply}` };
    yield { type: "log", entry: { ts: now(), actor: "system", entry: `Simulated reply recorded in evidence_requests — ${resp}` } };
    yield { type: "finding", finding: { id: fid("E"), agent: "orchestrator", title: final.evidence_requests[0]?.assumed_response ?? "Reply received", detail: resp, logOdds: final.case.fraud_probability >= 0.5 ? 2 : -2, confidence: 1, source: "customer · evidence_request:1" } };
    const post: Recommendation = {
      stage: "post_evidence",
      assessment: assessment(final, final.case.fraud_probability, true),
      actions: actions(final.next_best_actions.final, "final"),
      explanation: `${final.next_best_actions.what_changed} ${final.case.summary} Stop: ${final.stop_reason}`,
    };
    yield { type: "recommendation", recommendation: post };
    yield { type: "log", entry: { ts: now(), actor: "orchestrator", entry: `Final NBA: ${final.next_best_actions.final.map((a) => `${a.action} [${a.route}]`).join(", ")}` } };
  }

  yield { type: "sar", required: final.sar.file, draft: final.sar.file ? `SUSPICIOUS ACTIVITY REPORT — ${final.sar.reason}\nTotal: $${final.sar.total_amount_usd.toLocaleString()}\n\n${final.sar.narrative}` : undefined };
  yield { type: "log", entry: { ts: now(), actor: "memory", entry: `Case record: ${final.case.status} · verdict ${final.case.verdict} · p=${final.case.fraud_probability} · pattern ${final.case.pattern} · exposure $${final.case.exposure_usd}` } };
  yield { type: "done", caseStatus: final.case.status };
}

export function answerFile(id: string, reply: "agent" | "deny" | "confirm" = "agent") {
  return bundle(id).variants[reply];
}

export function memoryStats() {
  datasetMemory(1);
  const all = mem ?? [];
  const byPattern: Record<string, number> = {};
  all.forEach((m) => (byPattern[m.pattern] = (byPattern[m.pattern] ?? 0) + 1));
  return { total: all.length, fraud: all.filter((m) => m.outcome === "confirmed_fraud").length, byPattern };
}

/** Closed-case memory from the dataset (most recent first, capped for the UI). */
let mem: PastCase[] | null = null;
export function datasetMemory(limit = 240): PastCase[] {
  if (mem) return mem.slice(0, limit);
  const file = path.join(process.cwd(), "..", "data", "closed_cases_history.csv");
  if (!existsSync(file)) return [];
  const text = readFileSync(file, "utf8");
  const rows: string[][] = [];
  let cur: string[] = [], field = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') q = false;
      else field += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      cur.push(field);
      field = "";
    } else if (ch === "\n") {
      cur.push(field);
      rows.push(cur);
      cur = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  const [h, ...body] = rows;
  const ix = (k: string) => h.indexOf(k);
  mem = body
    .filter((r) => r.length >= h.length)
    .map((r) => ({
      id: r[ix("case_id")],
      closedAt: r[ix("closed_at")].slice(0, 10),
      pattern: r[ix("pattern")],
      outcome: r[ix("outcome")] as PastCase["outcome"],
      summary: r[ix("analyst_notes")],
      features: { exposure_usd: r[ix("exposure_usd")], card: r[ix("card_id")], txns: r[ix("n_txns")] } as unknown as PastCase["features"],
      analystDecision: r[ix("actions_taken")].replace(/\|/g, " → ") + (r[ix("report_filed")] === "Yes" ? " · SAR filed" : ""),
    }))
    .reverse();
  return mem.slice(0, limit);
}
