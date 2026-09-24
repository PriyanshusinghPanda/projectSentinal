import { CASES, CASE_MEMORY } from "./data";
import { retrievePolicy, type PolicyChunk } from "./rag";
import { policyQuery, type RunOptions } from "./engine";
import type { EvidenceOutcome, FraudCase, PastCase } from "./types";

/**
 * Demo cases (lib/data.ts) for the in-browser engine. The real exam cases come from lib/dataset.ts
 * (bundles written by agent/investigate.py, which is also what talks to TigerGraph over MCP).
 */
export const mode = "demo";
export const sourceLabel = "Mock graph";

export function memory(): PastCase[] {
  return CASE_MEMORY;
}

export async function listCases(): Promise<FraudCase[]> {
  return CASES;
}

export async function getCase(id: string): Promise<FraudCase> {
  const c = CASES.find((x) => x.id === id);
  if (!c) throw new Error(`case ${id} not found`);
  return c;
}

/** GraphRAG policy passages for the demo engine. */
export async function runContext(c: FraudCase): Promise<RunOptions & { policy: PolicyChunk[] }> {
  return { policy: await retrievePolicy(policyQuery(c), 3), toolLabel: sourceLabel };
}

/** Map a free-text evidence response to one of a case's outcome ids. */
export function outcomeFromResponse(text?: string): string | undefined {
  if (!text?.trim()) return undefined;
  const t = text.toLowerCase();
  if (/(not me|unauthori[sz]ed|did not|didn't|fail|denied|deny|fraud|stolen)/.test(t)) return "indicates_fraud";
  if (/(pass|legit|genuine|cleared|authori[sz]ed|was me|verified|confirm)/.test(t)) return "clears";
  return "no_response";
}

export type { EvidenceOutcome };
