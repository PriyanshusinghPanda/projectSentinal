import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { bundle, caseIds, PATTERN_NAMES } from "./dataset";

/** Human-in-the-loop decisions on L1 / L2 actions, persisted to web/.data/approvals.json. */
const FILE = path.join(process.cwd(), ".data", "approvals.json");

export interface Decision { decision: "approved" | "rejected"; by: string; at: string; note?: string }
type Store = Record<string, Decision>; // key: `${caseId}::${action}`

export function loadDecisions(): Store {
  return existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : {};
}

export function saveDecision(caseId: string, action: string, d: Decision) {
  const s = loadDecisions();
  s[`${caseId}::${action}`] = d;
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(s, null, 1));
}

export interface ApprovalItem {
  caseId: string; action: string; route: "L1" | "L2"; reason: string; exposure: number; verdict: string; pattern: string;
  probability: number; openedAt: string; card: string; decision?: Decision;
}

/** Every non-auto action in the agent's final recommendations, with its decision if one was made. */
export function approvalItems(): ApprovalItem[] {
  const d = loadDecisions();
  const out: ApprovalItem[] = [];
  for (const id of caseIds()) {
    const b = bundle(id);
    const a = b.variants.agent;
    for (const x of a.next_best_actions.final) {
      if (x.route === "auto") continue;
      out.push({
        caseId: id, action: x.action, route: x.route, reason: x.reason, exposure: a.case.exposure_usd, verdict: a.case.verdict,
        pattern: PATTERN_NAMES[a.case.pattern] ?? a.case.pattern, probability: a.case.fraud_probability, openedAt: b.context.opened_at,
        card: b.context.card_id, decision: d[`${id}::${x.action}`],
      });
    }
  }
  return out.sort((x, y) => (x.route === y.route ? y.exposure - x.exposure : x.route === "L2" ? -1 : 1));
}
