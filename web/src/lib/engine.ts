import { CASE_MEMORY, FRAUD_PATTERNS, POLICY } from "./data";
import type {
  Action,
  Assessment,
  CaseSignals,
  Dispute,
  EvidenceKind,
  EvidenceOutcome,
  Finding,
  FraudCase,
  InvestigationEvent,
  PastCase,
  Recommendation,
} from "./types";
import type { PolicyChunk } from "./rag";

/**
 * Multi-agent investigation engine.
 *
 * Specialists (graph, txn, device, memory, policy) each read signals and emit findings expressed as
 * log-odds contributions. The Challenger attacks those findings with alternative explanations; the
 * Orchestrator adjudicates disputes, computes a posterior + confidence, and decides whether to act or
 * gather more evidence. Deterministic by design so every decision is reproducible and auditable;
 * the LLM (lib/llm.ts) is only used to narrate the explanation.
 */

const PRIOR_LOG_ODDS = -1.1; // ~25% base rate among model-flagged transactions
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
let seq = 0;
const fid = (p: string) => `${p}-${++seq}`;

// ─── Specialist agents ────────────────────────────────────────────────────────

function graphAgent(c: FraudCase): Finding[] {
  const s = c.signals;
  const out: Finding[] = [];
  if (s.cardsOnDevice >= 5)
    out.push({ id: fid("G"), agent: "graph", title: `${s.cardsOnDevice} cards share one device`, detail: `Device fan-out far above the 99th percentile (2 cards). Weakly connected component of ${s.communitySize} entities.`, logOdds: 1.8, confidence: 0.85, source: "GSQL: shared_device_fanout + tg_wcc" });
  else if (s.cardsOnDevice >= 3)
    out.push({ id: fid("G"), agent: "graph", title: `${s.cardsOnDevice} cards on subject device`, detail: "Moderate device sharing.", logOdds: 0.6, confidence: 0.6, source: "GSQL: shared_device_fanout" });
  if (s.cardsOnIp >= 10)
    out.push({ id: fid("G"), agent: "graph", title: `IP seen with ${s.cardsOnIp} distinct cards`, detail: "High IP fan-out typical of proxy / farm infrastructure.", logOdds: 1.1, confidence: 0.7, source: "GSQL: ip_fanout" });
  if (s.hopsToConfirmedFraud !== null && s.hopsToConfirmedFraud <= 3)
    out.push({ id: fid("G"), agent: "graph", title: `${s.hopsToConfirmedFraud} hops from confirmed fraud`, detail: `Shortest path from subject card reaches an entity in a confirmed-fraud case.`, logOdds: s.hopsToConfirmedFraud <= 2 ? 1.5 : 0.7, confidence: 0.8, source: "GSQL: tg_shortest_ss_no_wt → fraud-labelled vertices" });
  if (out.length === 0)
    out.push({ id: fid("G"), agent: "graph", title: "Isolated, stable neighbourhood", detail: `Community size ${s.communitySize}; no path to known fraud within 4 hops.`, logOdds: -0.9, confidence: 0.75, source: "GSQL: k_hop_neighbourhood(4)" });
  return out;
}

function txnAgent(c: FraudCase): Finding[] {
  const s = c.signals;
  const out: Finding[] = [];
  if (s.smallAuthsBeforeLarge >= 3)
    out.push({ id: fid("T"), agent: "txn", title: `${s.smallAuthsBeforeLarge} micro-auths before large purchase`, detail: "Classic card-testing sequence: sub-$3 authorisations across rotating digital-goods merchants.", logOdds: 2.4, confidence: 0.9, source: "GSQL: card_txn_sequence(window=1h)" });
  if (s.velocity1h >= 5)
    out.push({ id: fid("T"), agent: "txn", title: `Velocity ${s.velocity1h} txns / hour`, detail: "Above customer's 90-day max of 2/hour.", logOdds: 0.8, confidence: 0.8, source: "GSQL: card_velocity" });
  if (s.amountZ >= 3)
    out.push({ id: fid("T"), agent: "txn", title: `Amount ${s.amountZ.toFixed(1)}σ above baseline`, detail: "Spend far outside 90-day history.", logOdds: s.amountZ >= 5 ? 1.2 : 0.8, confidence: 0.75, source: "GSQL: customer_amount_profile" });
  else if (s.amountZ < 2)
    out.push({ id: fid("T"), agent: "txn", title: `Amount within normal range (${s.amountZ.toFixed(1)}σ)`, detail: "Consistent with prior large purchases at similar merchants.", logOdds: -0.8, confidence: 0.7, source: "GSQL: customer_amount_profile" });
  else
    out.push({ id: fid("T"), agent: "txn", title: `Elevated amount (${s.amountZ.toFixed(1)}σ)`, detail: "Moderately above baseline.", logOdds: 0.3, confidence: 0.6, source: "GSQL: customer_amount_profile" });
  return out;
}

function deviceAgent(c: FraudCase): Finding[] {
  const s = c.signals;
  const out: Finding[] = [];
  if (s.newDevice)
    out.push({ id: fid("D"), agent: "device", title: "First-seen device", detail: "Device fingerprint never observed on this account before today.", logOdds: 1.2, confidence: 0.8, source: "GSQL: device_first_seen" });
  else if (s.deviceAgeDays > 365)
    out.push({ id: fid("D"), agent: "device", title: `Trusted device (${Math.round(s.deviceAgeDays / 30)} months)`, detail: "Long-standing device with hundreds of clean transactions.", logOdds: -1.4, confidence: 0.85, source: "GSQL: device_history" });
  else if (s.deviceAgeDays < 30)
    out.push({ id: fid("D"), agent: "device", title: `Young device (${s.deviceAgeDays} days)`, detail: "Device and account are both recently created.", logOdds: 0.5, confidence: 0.6, source: "GSQL: device_history" });
  if (s.emailDomainMismatch)
    out.push({ id: fid("D"), agent: "device", title: "Purchaser / recipient email domains differ", detail: "P_emaildomain ≠ R_emaildomain — associated with synthetic & mule profiles.", logOdds: 0.9, confidence: 0.65, source: "GSQL: identity_email_links" });
  if (s.addrChanged7d)
    out.push({ id: fid("D"), agent: "device", title: "Address changed within 7 days", detail: "Profile change shortly before spend; address shared with another new account.", logOdds: 1.0, confidence: 0.7, source: "GSQL: identity_changes" });
  return out;
}

function similarity(s: CaseSignals, p: PastCase): number {
  const keys = Object.keys(p.features) as (keyof CaseSignals)[];
  if (!keys.length) return 0;
  let score = 0;
  for (const k of keys) {
    const a = s[k];
    const b = p.features[k];
    if (typeof b === "boolean") score += a === b ? 1 : 0;
    else if (typeof b === "number" && typeof a === "number") score += 1 - Math.min(1, Math.abs(a - b) / Math.max(1, Math.abs(b)));
    else if (b === null && a === null) score += 1;
  }
  return score / keys.length;
}

export function similarCases(c: FraudCase, memory: PastCase[] = CASE_MEMORY) {
  return memory
    .map((p) => ({ ...p, similarity: Math.round(similarity(c.signals, p) * 100) / 100 }))
    .filter((p) => p.similarity >= 0.45)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 3);
}

function memoryAgent(sim: ReturnType<typeof similarCases>): Finding[] {
  if (!sim.length)
    return [{ id: fid("M"), agent: "memory", title: "No close precedent", detail: "No prior case above 0.45 similarity — possible undocumented pattern.", logOdds: 0, confidence: 0.4, source: "Vector search: case_embeddings" }];
  const top = sim[0];
  const fraudShare = sim.filter((x) => x.outcome === "confirmed_fraud").length / sim.length;
  const lo = (fraudShare - 0.5) * 2 * top.similarity * 1.6;
  return [
    {
      id: fid("M"),
      agent: "memory",
      title: `${sim.length} similar past case${sim.length > 1 ? "s" : ""} · ${Math.round(fraudShare * 100)}% confirmed fraud`,
      detail: `Closest: ${top.id} (${Math.round(top.similarity * 100)}% match, ${top.outcome.replace("_", " ")}) — “${top.analystDecision}”`,
      logOdds: Math.round(lo * 100) / 100,
      confidence: 0.5 + top.similarity * 0.4,
      source: "GraphRAG: case memory (vector + graph neighbourhood)",
    },
  ];
}

function matchPattern(s: CaseSignals) {
  const scores: Record<string, number> = {
    P1: (s.smallAuthsBeforeLarge >= 3 ? 0.6 : 0) + (s.velocity1h >= 5 ? 0.3 : 0) + (s.cardsOnIp >= 10 ? 0.1 : 0),
    P2: (s.newDevice ? 0.45 : 0) + (s.addrChanged7d ? 0.25 : 0) + (s.amountZ >= 3 ? 0.3 : 0),
    P3: (s.cardsOnDevice >= 5 ? 0.5 : 0) + (s.cardsOnIp >= 10 ? 0.2 : 0) + (s.hopsToConfirmedFraud !== null && s.hopsToConfirmedFraud <= 2 ? 0.3 : 0),
    P4: (s.emailDomainMismatch ? 0.35 : 0) + (s.addrChanged7d ? 0.35 : 0) + (s.deviceAgeDays < 30 && !s.newDevice ? 0.3 : 0),
    P5: (s.customerReported ? 0.55 : 0) + (s.deviceAgeDays > 365 ? 0.45 : 0),
  };
  const [id, match] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (match < 0.5) return null;
  const p = FRAUD_PATTERNS.find((x) => x.id === id)!;
  return { id, name: p.name, match: Math.min(1, match) };
}

function policyAgent(c: FraudCase, pattern: ReturnType<typeof matchPattern>, policy: PolicyChunk[] = []): Finding[] {
  const subject = c.transactions.find((t) => t.id === c.subjectTxnId)!;
  const exposure = c.transactions.filter((t) => t.riskScore >= 0.5).reduce((a, t) => a + t.amount, 0);
  const out: Finding[] = [
    {
      id: fid("P"),
      agent: "policy",
      title: pattern ? `Matches typology ${pattern.id}: ${pattern.name}` : "No documented typology matched",
      detail: pattern
        ? `${FRAUD_PATTERNS.find((p) => p.id === pattern.id)!.description} (match ${Math.round(pattern.match * 100)}%)`
        : "Signals do not fit the five documented patterns — flag as candidate new typology.",
      logOdds: pattern ? 0.4 * pattern.match : 0,
      confidence: pattern ? pattern.match : 0.4,
      source: "GraphRAG: fraud_typologies.md",
    },
  ];
  out.push({
    id: fid("P"),
    agent: "policy",
    title: `Exposure $${exposure.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
    detail: exposure >= POLICY.sarThresholdUsd || (pattern?.id === "P3")
      ? `At/above SAR threshold ($${POLICY.sarThresholdUsd.toLocaleString()}) or organised activity — SAR required if fraud is suspected. ${POLICY.sections.sar}`
      : `Below SAR threshold ($${POLICY.sarThresholdUsd.toLocaleString()}). Subject txn $${subject.amount.toLocaleString()}.`,
    logOdds: 0,
    confidence: 1,
    source: "GraphRAG: bank_fraud_policy.pdf §6.2",
  });
  for (const ch of policy.slice(0, 2))
    out.push({
      id: fid("P"),
      agent: "policy",
      title: `Policy basis: ${ch.section}`,
      detail: ch.text.length > 280 ? ch.text.slice(0, 280) + "…" : ch.text,
      logOdds: 0,
      confidence: 1,
      source: `GraphRAG: ${ch.doc} · ${ch.section}`,
    });
  return out;
}

// ─── Challenger agent ─────────────────────────────────────────────────────────

function challenger(c: FraudCase, findings: Finding[], sim: ReturnType<typeof similarCases>): Dispute[] {
  const s = c.signals;
  const d: Dispute[] = [];
  const find = (pred: (f: Finding) => boolean) => findings.find(pred);

  const dev = find((f) => f.agent === "device" && f.title === "First-seen device");
  if (dev && s.customerTraveling)
    d.push({ id: fid("X"), targetFindingId: dev.id, argument: "Customer booked a flight to Lisbon on Sep 23 and the new device connects via a Portuguese mobile carrier. A new phone/SIM while travelling is a common benign explanation.", adjustedLogOdds: 0.3, upheld: true });

  const ip = find((f) => f.agent === "graph" && f.title.startsWith("IP seen"));
  if (ip && s.corporateNatIp)
    d.push({ id: fid("X"), targetFindingId: ip.id, argument: "IP belongs to a corporate NAT / carrier range; high card fan-out is expected there and should not be counted as ring evidence.", adjustedLogOdds: 0.2, upheld: true });

  const shared = find((f) => f.agent === "graph" && f.title.includes("cards share one device"));
  if (shared) {
    const kiosk = sim.find((p) => p.id === "HHG-1902");
    d.push({
      id: fid("X"),
      targetFindingId: shared.id,
      argument: kiosk
        ? `Precedent ${kiosk.id}: a public kiosk with 8 cards was cleared. Device sharing alone does not prove a ring — need fund-flow linkage.`
        : "Device sharing alone does not prove a ring — need fund-flow linkage.",
      adjustedLogOdds: 0.4,
      upheld: true, // sharing alone is not proof; the ring needs fund-flow linkage
    });
  }

  const amt = find((f) => f.agent === "txn" && f.title.startsWith("Amount") && f.logOdds > 0);
  if (amt && c.customer.tenureMonths > 48 && !s.newDevice)
    d.push({ id: fid("X"), targetFindingId: amt.id, argument: `Customer tenure ${c.customer.tenureMonths} months; large one-off purchases are routine for Premier customers.`, adjustedLogOdds: 0.2, upheld: true });

  if (s.customerReported) {
    const trusted = find((f) => f.agent === "device" && f.title.startsWith("Trusted device"));
    if (trusted)
      d.push({ id: fid("X"), targetFindingId: trusted.id, argument: "A trusted device does not rule out a household member or remote-access scam. Customer report must be weighed; do not dismiss as friendly fraud without merchant evidence.", adjustedLogOdds: -0.6, upheld: true });
  }

  const mem = find((f) => f.agent === "memory");
  if (mem && sim.length && new Set(sim.map((x) => x.outcome)).size > 1)
    d.push({ id: fid("X"), targetFindingId: mem.id, argument: "Precedents are split between confirmed and cleared — memory should not tip the decision on its own.", adjustedLogOdds: mem.logOdds * 0.4, upheld: true });

  return d;
}

// ─── Orchestrator ─────────────────────────────────────────────────────────────

export function assess(c: FraudCase, findings: Finding[], disputes: Dispute[], extraLogOdds = 0, resolved = false): Assessment {
  const upheld = new Map(disputes.filter((d) => d.upheld).map((d) => [d.targetFindingId, d.adjustedLogOdds]));
  let lo = PRIOR_LOG_ODDS + extraLogOdds;
  let agreeing = 0;
  let weighted = 0;
  for (const f of findings) {
    const v = upheld.has(f.id) ? upheld.get(f.id)! : f.logOdds;
    lo += v * f.confidence;
    weighted += Math.abs(v) * f.confidence;
    agreeing += Math.sign(v) === Math.sign(lo - PRIOR_LOG_ODDS) ? Math.abs(v) * f.confidence : 0;
  }
  const risk = sigmoid(lo);
  const agreement = weighted ? agreeing / weighted : 0.5;
  const decisiveness = Math.abs(risk - 0.5) * 2;
  let confidence = 0.35 * agreement + 0.45 * decisiveness + 0.2 * Math.min(1, findings.length / 8);
  confidence -= disputes.filter((d) => d.upheld).length * 0.04;
  if (resolved) confidence = Math.max(confidence, 0.85);
  confidence = Math.max(0.05, Math.min(0.98, confidence));
  const band = risk >= 0.85 ? "critical" : risk >= 0.6 ? "high" : risk >= 0.3 ? "medium" : "low";
  return {
    riskScore: Math.round(risk * 1000) / 1000,
    confidence: Math.round(confidence * 100) / 100,
    pattern: matchPattern(c.signals),
    band,
    enoughEvidence: confidence >= POLICY.actToConfidence,
  };
}

function chooseEvidence(c: FraudCase, a: Assessment): Recommendation["evidenceRequest"] {
  const s = c.signals;
  const pid = a.pattern?.id;
  let kind: EvidenceKind = "customer_confirmation";
  let label = "Ask account owner to confirm the transaction";
  let why = "Owner confirmation is the cheapest discriminating signal for this case.";
  if (s.newDevice && (pid === "P2" || s.customerTraveling)) {
    kind = "step_up_auth";
    label = "Step-up authentication on registered phone";
    why = "The disagreement hinges on who controls the new device — biometric step-up on the registered phone resolves it directly.";
  } else if (pid === "P3") {
    kind = "analyst_review";
    label = "Analyst fund-flow review of the 9 linked cards";
    why = "Device sharing is disputed (kiosk precedent). Fund-flow linkage across cards is the discriminating evidence and needs human review.";
  } else if (pid === "P5" || s.customerReported) {
    kind = "merchant_inquiry";
    label = "Request delivery evidence from merchant";
    why = "Trusted device + dispute is ambiguous between friendly fraud and household/ATO misuse; proof of delivery separates them.";
  } else if (pid === "P4") {
    kind = "customer_confirmation";
    label = "Document + liveness KYC re-verification";
    why = "Synthetic identity can only be confirmed or cleared by identity verification.";
  }
  const expectedGain = Math.round((1 - a.confidence) * (1 - Math.abs(a.riskScore - 0.5)) * 100) / 100;
  return { kind, label, why, expectedGain };
}

function actionsFor(c: FraudCase, a: Assessment, stage: Recommendation["stage"]): Action[] {
  const exposure = c.transactions.filter((t) => t.riskScore >= 0.5).reduce((s, t) => s + t.amount, 0);
  const act = (x: Omit<Action, "id">): Action => ({ id: fid("A"), ...x });
  const out: Action[] = [];
  const S = POLICY.sections;

  if (a.riskScore >= 0.85) {
    const auto = a.riskScore >= POLICY.autoBlockMinRisk && a.confidence >= POLICY.autoBlockMinConfidence;
    out.push(act({ kind: "block_txn", label: `Block transaction ${c.subjectTxnId}`, approval: auto ? "auto" : "analyst", rationale: auto ? "Risk and confidence exceed auto-block thresholds." : "High risk but below auto-block confidence — analyst confirms.", policyRef: S.block }));
    out.push(act({ kind: "freeze_account", label: `Restrict account ${c.customer.id}`, approval: "analyst", rationale: "Prevent further loss while case is open.", policyRef: S.freeze }));
    if (exposure >= POLICY.sarThresholdUsd || a.pattern?.id === "P3" || a.pattern?.id === "P4")
      out.push(act({ kind: "file_sar", label: "File Suspicious Activity Report", approval: "senior_compliance", rationale: `Exposure $${Math.round(exposure).toLocaleString()} / organised pattern meets SAR criteria.`, policyRef: S.sar }));
    out.push(act({ kind: "warn_customer", label: "Notify customer via verified channel", approval: "auto", rationale: "Customer must be informed of block and card reissue.", policyRef: S.contact }));
  } else if (a.riskScore >= 0.15 && !a.enoughEvidence) {
    out.push(act({ kind: "block_txn", label: `Hold transaction ${c.subjectTxnId} pending evidence`, approval: "auto", rationale: "Temporary hold is reversible and limits exposure while uncertainty is resolved.", policyRef: S.block }));
    
    out.push(act({ kind: "escalate_analyst", label: "Queue for analyst if unresolved in 30 min", approval: "auto", rationale: "Human fallback when evidence does not arrive.", policyRef: S.freeze }));
  } else if (a.riskScore >= 0.3) {
    out.push(act({ kind: "escalate_analyst", label: "Escalate to fraud analyst", approval: "analyst", rationale: "Medium risk with adequate evidence — human decision on restriction.", policyRef: S.freeze }));
    out.push(act({ kind: "monitor_account", label: "Enhanced monitoring 30 days", approval: "auto", rationale: "Keep watch on residual risk.", policyRef: S.monitor }));
  } else {
    out.push(act({ kind: "allow_txn", label: `Allow transaction ${c.subjectTxnId}`, approval: "auto", rationale: "Evidence supports legitimate activity.", policyRef: S.block }));
    out.push(act({ kind: "monitor_account", label: "Light monitoring 14 days", approval: "auto", rationale: "Residual model risk; cheap to monitor.", policyRef: S.monitor }));
    if (stage === "post_evidence" || c.signals.customerReported)
      out.push(act({ kind: "close_case", label: "Close case as not fraud", approval: "analyst", rationale: "Analyst sign-off required to close.", policyRef: S.friendly }));
  }
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x.kind) ? false : (seen.add(x.kind), true)));
}

function explain(c: FraudCase, a: Assessment, findings: Finding[], disputes: Dispute[], stage: Recommendation["stage"], ev?: EvidenceOutcome) {
  const top = [...findings].sort((x, y) => Math.abs(y.logOdds * y.confidence) - Math.abs(x.logOdds * x.confidence)).slice(0, 3);
  const upheld = disputes.filter((d) => d.upheld);
  const parts = [
    `Risk ${(a.riskScore * 100).toFixed(0)}% (${a.band}) at ${(a.confidence * 100).toFixed(0)}% confidence${a.pattern ? `, best match ${a.pattern.id} ${a.pattern.name}` : ", no documented typology"}.`,
    `Strongest evidence: ${top.map((f) => f.title.toLowerCase()).join("; ")}.`,
  ];
  if (upheld.length) parts.push(`Challenger upheld ${upheld.length} dispute${upheld.length > 1 ? "s" : ""}, discounting ${upheld.length > 1 ? "those findings" : "that finding"}.`);
  if (stage === "post_evidence" && ev) parts.push(`New evidence — ${ev.label}: ${ev.description}`);
  parts.push(a.enoughEvidence ? "Confidence meets the policy threshold, so the agent stops investigating and acts." : "Confidence is below the policy threshold, so the agent requests more evidence before taking irreversible action.");
  return parts.join(" ");
}

export function sarDraft(c: FraudCase, a: Assessment, findings: Finding[]) {
  const exposure = c.transactions.filter((t) => t.riskScore >= 0.5).reduce((s, t) => s + t.amount, 0);
  return [
    `SUSPICIOUS ACTIVITY REPORT — DRAFT (requires senior compliance approval)`,
    `Case: ${c.id} · Subject: ${c.customer.id} · Filed by: Sentinel agent`,
    `Activity: ${a.pattern ? a.pattern.name : "Unclassified suspicious activity"} · Total exposure: $${exposure.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
    `Transactions: ${c.transactions.filter((t) => t.riskScore >= 0.5).map((t) => `${t.id} ($${t.amount})`).join(", ")}`,
    ``,
    `Narrative: ${findings.filter((f) => f.logOdds > 0).map((f) => f.title + ". " + f.detail).join(" ")}`,
    ``,
    `Assessment: ${(a.riskScore * 100).toFixed(0)}% fraud probability, ${(a.confidence * 100).toFixed(0)}% confidence.`,
  ].join("\n");
}

// ─── Run ──────────────────────────────────────────────────────────────────────

export interface RunOptions {
  evidenceOutcomeId?: string; // present → phase 2
  similar?: (PastCase & { similarity: number })[]; // from TigerGraph similar_cases_by_entities; else feature similarity over memory
  memory?: PastCase[];
  policy?: PolicyChunk[]; // GraphRAG-retrieved policy passages
  toolLabel?: string; // "TigerGraph MCP" | "TigerGraph REST++" | "Mock graph"
}

/** Query string the Policy agent uses to retrieve policy passages for this case. */
export function policyQuery(c: FraudCase) {
  const s = c.signals;
  const p = matchPattern(s);
  return [
    p?.name ?? "suspicious activity",
    "block transaction freeze restrict account approval SAR suspicious activity report threshold customer contact",
    s.newDevice ? "new device step-up authentication account takeover" : "",
    s.cardsOnDevice >= 5 ? "shared device mule ring organised" : "",
    s.smallAuthsBeforeLarge >= 3 ? "card testing small authorisations" : "",
    s.emailDomainMismatch || s.addrChanged7d ? "synthetic identity KYC verification" : "",
    s.customerReported ? "customer dispute chargeback friendly fraud merchant evidence" : "",
  ].join(" ");
}

export function* investigate(c: FraudCase, opts: RunOptions = {}): Generator<InvestigationEvent> {
  seq = 0;
  const now = () => new Date().toISOString();
  const findings: Finding[] = [];

  yield { type: "status", phase: "trigger", message: `Case ${c.id} opened · ${c.triggerDetail}` };
  yield { type: "log", entry: { ts: now(), actor: "system", entry: `Case created from ${c.trigger.replace("_", " ")} trigger` } };

  yield { type: "agent_start", agent: "orchestrator", task: "Plan investigation and dispatch specialists" };
  yield { type: "status", phase: "investigate", message: "Dispatching 5 specialist agents in parallel" };

  const specialists: [Finding["agent"], string, string, () => Finding[]][] = [
    ["graph", "Traverse entity graph around subject card", `tigergraph__run_installed_query case_context(${c.subjectTxnId}) · device/IP fan-out, BFS to confirmed fraud`, () => graphAgent(c)],
    ["txn", "Profile transaction sequence & amounts", `tigergraph__run_installed_query case_context(${c.subjectTxnId}) · card history, 1h velocity`, () => txnAgent(c)],
    ["device", "Check device, email & identity signals", `tigergraph__run_installed_query case_context(${c.subjectTxnId}) · device first-seen, email domains`, () => deviceAgent(c)],
  ];
  for (const [agent, task, q, run] of specialists) {
    yield { type: "agent_start", agent, task };
    yield { type: "tool_call", agent, tool: opts.toolLabel ?? "TigerGraph MCP", query: q };
    for (const f of run()) {
      findings.push(f);
      yield { type: "finding", finding: f };
    }
  }

  yield { type: "agent_start", agent: "memory", task: "Retrieve similar past cases" };
  yield { type: "tool_call", agent: "memory", tool: "GraphRAG", query: opts.similar ? `similar_cases_by_entities(${c.subjectTxnId}, k=5)` : "feature similarity over closed-case memory" };
  const sim = opts.similar ?? similarCases(c, opts.memory);
  yield { type: "similar_cases", cases: sim };
  for (const f of memoryAgent(sim)) {
    findings.push(f);
    yield { type: "finding", finding: f };
  }

  yield { type: "agent_start", agent: "policy", task: "Ground in policy & typologies" };
  yield { type: "tool_call", agent: "policy", tool: "GraphRAG", query: `retrieve(policy ∪ typologies ∪ regulations | ${matchPattern(c.signals)?.name ?? "signals"}) → ${opts.policy?.length ?? 0} passages` };
  for (const f of policyAgent(c, matchPattern(c.signals), opts.policy)) {
    findings.push(f);
    yield { type: "finding", finding: f };
  }

  yield { type: "status", phase: "challenge", message: "Challenger reviewing findings for alternative explanations" };
  yield { type: "agent_start", agent: "challenger", task: "Argue the opposite case against every finding" };
  const disputes = challenger(c, findings, sim);
  for (const d of disputes) yield { type: "dispute", dispute: d };
  if (!disputes.length) yield { type: "log", entry: { ts: now(), actor: "challenger", entry: "No credible alternative explanation found" } };

  yield { type: "status", phase: "assess", message: "Orchestrator adjudicating and assessing uncertainty" };
  yield { type: "agent_start", agent: "orchestrator", task: "Adjudicate disputes, compute risk & confidence" };
  const a1 = assess(c, findings, disputes);
  const ev1 = a1.enoughEvidence ? undefined : chooseEvidence(c, a1);
  const preActions = actionsFor(c, a1, "pre_evidence");
  if (ev1 && !preActions.some((x) => x.kind === "request_confirmation"))
    preActions.unshift({ id: fid("A"), kind: "request_confirmation", label: ev1.label, approval: ev1.kind === "analyst_review" ? "analyst" : "auto", rationale: ev1.why, policyRef: POLICY.sections.stepUp });
  const pre: Recommendation = { stage: "pre_evidence", assessment: a1, actions: preActions, evidenceRequest: ev1, explanation: explain(c, a1, findings, disputes, "pre_evidence") };
  yield { type: "recommendation", recommendation: pre };
  yield { type: "log", entry: { ts: now(), actor: "orchestrator", entry: `Pre-evidence NBA: ${pre.actions.map((x) => `${x.label} [${x.approval}]`).join("; ")}` } };

  let final = a1;
  if (ev1) {
    yield { type: "log", entry: { ts: now(), actor: "orchestrator", entry: `Evidence requested: ${ev1.label}` } };
    if (!opts.evidenceOutcomeId) {
      yield { type: "status", phase: "awaiting_evidence", message: `Awaiting: ${ev1.label}` };
      yield { type: "done", caseStatus: "awaiting_evidence" };
      return;
    }
    const outcome = c.evidenceOutcomes.find((o) => o.id === opts.evidenceOutcomeId) ?? c.evidenceOutcomes[0];
    yield { type: "status", phase: "evidence", message: `Evidence received: ${outcome.label}` };
    yield { type: "log", entry: { ts: now(), actor: "system", entry: `Evidence received — ${outcome.label}: ${outcome.description}` } };
    const evFinding: Finding = { id: fid("E"), agent: "orchestrator", title: outcome.label, detail: outcome.description, logOdds: outcome.logOddsShift, confidence: 1, source: ev1.label };
    findings.push(evFinding);
    yield { type: "finding", finding: evFinding };
    final = assess(c, findings, disputes, 0, outcome.resolves);
    const post: Recommendation = { stage: "post_evidence", assessment: final, actions: actionsFor(c, final, "post_evidence"), explanation: explain(c, final, findings, disputes, "post_evidence", outcome) };
    if (!final.enoughEvidence) {
      post.actions = [
        { id: fid("A"), kind: "escalate_analyst", label: "Escalate to fraud analyst — evidence inconclusive", approval: "analyst", rationale: `Max automated evidence rounds reached (${POLICY.maxEvidenceRounds}); human judgement required.`, policyRef: POLICY.sections.freeze },
        ...post.actions.filter((x) => x.kind !== "request_confirmation" && x.kind !== "escalate_analyst"),
      ];
    }
    yield { type: "recommendation", recommendation: post };
    yield { type: "log", entry: { ts: now(), actor: "orchestrator", entry: `Post-evidence NBA: ${post.actions.map((x) => `${x.label} [${x.approval}]`).join("; ")}` } };
  }

  const exposure = c.transactions.filter((t) => t.riskScore >= 0.5).reduce((s, t) => s + t.amount, 0);
  const sarRequired = final.riskScore >= 0.6 && (exposure >= POLICY.sarThresholdUsd || final.pattern?.id === "P3" || final.pattern?.id === "P4");
  yield { type: "sar", required: sarRequired, draft: sarRequired ? sarDraft(c, final, findings) : undefined };
  yield { type: "log", entry: { ts: now(), actor: "memory", entry: `Case memory updated: ${c.id} → ${final.riskScore >= 0.6 ? "suspected fraud" : "likely legitimate"} (${final.pattern?.name ?? "unclassified"})` } };
  const status = final.riskScore >= 0.6 ? "pending_approval" : final.enoughEvidence ? "resolved_legit" : "escalated";
  yield { type: "done", caseStatus: status };
}

/** Summary used by the queue without running the full stream. */
export function quickAssess(c: FraudCase) {
  const events = Array.from(investigate(c));
  const rec = events.filter((e) => e.type === "recommendation").pop() as Extract<InvestigationEvent, { type: "recommendation" }> | undefined;
  return rec?.recommendation.assessment;
}
