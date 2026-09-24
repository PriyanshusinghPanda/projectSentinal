import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { POLICY } from "./data";

/**
 * GraphRAG text side: retrieve the policy / typology / regulation passages relevant to the case's signals,
 * so the Policy agent and the LLM get grounded context instead of raw data.
 * Corpus: load_data/policy_chunks.json if present, else the built-in demo policy.
 */
export interface PolicyChunk {
  id: string;
  doc: string;
  section: string;
  text: string;
}

export const LOAD_DATA_DIR = process.env.SENTINEL_LOAD_DATA ?? path.join(process.cwd(), "..", "tigergraph", "load_data");

const BUILTIN: PolicyChunk[] = Object.entries(POLICY.sections).map(([k, v]) => ({ id: `builtin#${k}`, doc: "built-in policy (placeholder)", section: v, text: v }));

let corpus: Promise<PolicyChunk[]> | null = null;

async function loadCorpus(): Promise<PolicyChunk[]> {
  const file = path.join(LOAD_DATA_DIR, "policy_chunks.json");
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  return BUILTIN;
}

const tokenize = (s: string) => s.toLowerCase().match(/[a-z0-9$§.]+/g) ?? [];

/** BM25 over chunks. Small corpus, so this runs in-process per request. */
export async function retrievePolicy(query: string, k = 3): Promise<PolicyChunk[]> {
  corpus ??= loadCorpus();
  const docs = await corpus;
  const toks = docs.map((d) => tokenize(`${d.section} ${d.text}`));
  const avg = toks.reduce((a, t) => a + t.length, 0) / Math.max(1, toks.length);
  const df = new Map<string, number>();
  toks.forEach((t) => new Set(t).forEach((w) => df.set(w, (df.get(w) ?? 0) + 1)));
  const q = Array.from(new Set(tokenize(query)));
  const scored = docs.map((d, i) => {
    const tf = new Map<string, number>();
    toks[i].forEach((w) => tf.set(w, (tf.get(w) ?? 0) + 1));
    let s = 0;
    for (const w of q) {
      const f = tf.get(w) ?? 0;
      if (!f) continue;
      const idf = Math.log(1 + (docs.length - (df.get(w) ?? 0) + 0.5) / ((df.get(w) ?? 0) + 0.5));
      s += (idf * f * 2.2) / (f + 1.2 * (0.25 + 0.75 * (toks[i].length / avg)));
    }
    return { d, s };
  });
  return scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, k).map((x) => x.d);
}
