import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/** Analytics exported by agent/export_insights.py (backtest, audit, rings, monitoring, rule usage). */
const DIR = process.env.SENTINEL_INSIGHTS ?? path.join(process.cwd(), "insights");

export function insight<T>(name: string, fallback: T): T {
  const p = path.join(DIR, `${name}.json`);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : fallback;
}

export interface RingComponent { id: string; customers: string[]; devices: string[]; txns: number; amount: number; fraud_cases: string[] }
export interface MonitoringSummary {
  period_txns: number; threshold: number; alerts: number; model_alerts: number; ring_alerts: number; card_days: number;
  triage: Record<string, number>; patterns: Record<string, number>;
  investigated: { id: string; opened_at: string; txn: string; amount: number; model_score: number; p0: number; pattern: string; verdict: string; status: string; ring: boolean; actions: string[] }[];
}

/** Read a monitoring investigation file (../monitoring/MON-*.json). */
export function monitoringCase(id: string) {
  if (!/^MON-\d+$/.test(id)) return null;
  const p = path.join(process.cwd(), "..", "monitoring", `${id}.json`);
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}
