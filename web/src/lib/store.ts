import type { DecisionLogEntry, PastCase } from "./types";

/** In-process case state for the UI session. The durable record is written to TigerGraph (lib/source.ts). */
type CaseState = { status: string; approvals: Record<string, "approved" | "rejected">; log: DecisionLogEntry[] };

const g = globalThis as unknown as { __sentinel?: { cases: Record<string, CaseState>; closed: PastCase[] } };
g.__sentinel ??= { cases: {}, closed: [] };
export const store = g.__sentinel;

export function caseState(id: string): CaseState {
  return (store.cases[id] ??= { status: "new", approvals: {}, log: [] });
}
