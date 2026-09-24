export type TriggerType = "risk_score" | "customer_report" | "analyst_request";

export type AgentId =
  | "graph"
  | "txn"
  | "device"
  | "memory"
  | "policy"
  | "challenger"
  | "orchestrator";

export type NodeKind = "card" | "account" | "device" | "email" | "ip" | "address" | "merchant";

export interface GraphNode {
  id: string;
  kind: NodeKind;
  label: string;
  flagged?: boolean; // linked to a confirmed-fraud case
  subject?: boolean; // the entity under investigation
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
}

export interface Transaction {
  id: string; // TransactionID
  ts: string;
  amount: number; // TransactionAmt
  productCD: "W" | "C" | "R" | "H" | "S";
  merchant: string;
  deviceId?: string;
  ip?: string;
  riskScore: number; // bank model score 0..1
  subject?: boolean;
  channel?: "online" | "in_person";
  region?: string;
  deviceNew?: boolean;
}

/** Raw signals the specialist agents read. In production these come from GSQL queries via TigerGraph MCP. */
export interface CaseSignals {
  velocity1h: number; // txns on card in last hour
  smallAuthsBeforeLarge: number; // card-testing probes
  amountZ: number; // z-score vs customer's 90d history
  newDevice: boolean;
  deviceAgeDays: number;
  cardsOnDevice: number; // distinct cards seen on the same device
  cardsOnIp: number;
  emailDomainMismatch: boolean; // purchaser vs recipient domain
  addrChanged7d: boolean;
  hopsToConfirmedFraud: number | null; // shortest path to entity in a confirmed-fraud case
  communitySize: number; // WCC / Louvain community size around subject
  customerTraveling?: boolean; // external / CRM context
  corporateNatIp?: boolean; // IP belongs to a known corporate NAT / mobile carrier
  customerReported?: boolean;
}

export type EvidenceKind = "step_up_auth" | "customer_confirmation" | "analyst_review" | "merchant_inquiry";

export interface EvidenceOutcome {
  id: string;
  label: string;
  description: string;
  logOddsShift: number; // how the outcome moves the fraud assessment
  resolves: boolean;
}

export interface FraudCase {
  id: string;
  title: string;
  trigger: TriggerType;
  triggerDetail: string;
  openedAt: string;
  customer: { id: string; name: string; tenureMonths: number; segment: string };
  subjectTxnId: string;
  transactions: Transaction[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  signals: CaseSignals;
  evidenceOutcomes: EvidenceOutcome[]; // simulated responses for the requested evidence
}

export interface Finding {
  id: string;
  agent: AgentId;
  title: string;
  detail: string;
  logOdds: number; // + = toward fraud, - = toward legit
  confidence: number; // 0..1 agent's own confidence in the finding
  source: string; // e.g. "GSQL: shared_device_cards", "GraphRAG: policy §4.2"
  disputedBy?: string;
}

export interface Dispute {
  id: string;
  targetFindingId: string;
  argument: string;
  adjustedLogOdds: number;
  upheld: boolean; // orchestrator accepts the dispute
}

export type ApprovalRoute = "auto" | "analyst" | "senior_compliance" | "L1" | "L2";

export interface Action {
  id: string;
  label: string;
  kind: string; // demo engine kinds, or Fraud Policy v1.0 action ids (BLOCK_CARD, FILE_REPORT, …)
  approval: ApprovalRoute;
  rationale: string;
  policyRef: string;
}

export interface Assessment {
  riskScore: number; // 0..1 posterior fraud probability
  confidence: number; // 0..1
  pattern: { id: string; name: string; match: number } | null;
  band: "low" | "medium" | "high" | "critical";
  enoughEvidence: boolean;
}

export interface Recommendation {
  stage: "pre_evidence" | "post_evidence";
  assessment: Assessment;
  actions: Action[];
  evidenceRequest?: { kind: EvidenceKind; label: string; why: string; expectedGain: number };
  explanation: string;
}

export interface PastCase {
  id: string;
  closedAt: string;
  pattern: string;
  outcome: "confirmed_fraud" | "cleared";
  summary: string;
  features: Partial<CaseSignals>;
  analystDecision: string;
  why?: string; // why it was retrieved for the current case
}

export interface DecisionLogEntry {
  ts: string;
  actor: AgentId | "analyst" | "system";
  entry: string;
}

/** Events streamed from the investigate API to the UI. */
export type InvestigationEvent =
  | { type: "status"; phase: string; message: string }
  | { type: "agent_start"; agent: AgentId; task: string }
  | { type: "tool_call"; agent: AgentId; tool: string; query: string }
  | { type: "finding"; finding: Finding }
  | { type: "similar_cases"; cases: (PastCase & { similarity: number })[] }
  | { type: "dispute"; dispute: Dispute }
  | { type: "recommendation"; recommendation: Recommendation }
  | { type: "log"; entry: DecisionLogEntry }
  | { type: "sar"; required: boolean; draft?: string }
  | { type: "narrative"; stage: Recommendation["stage"]; text: string; model: string }
  | { type: "done"; caseStatus: string };
