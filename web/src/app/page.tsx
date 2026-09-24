import type { Metadata } from "next";
import { Landing, type LandingStats } from "@/components/landing/Landing";
import { caseIds, datasetAvailable, summary } from "@/lib/dataset";

export const metadata: Metadata = {
  title: "Sentinel — Agentic fraud investigation on TigerGraph",
  description: "Seven agents investigate card fraud on a graph, argue with each other, ask for evidence when unsure, and recommend policy-bound actions an analyst approves.",
};

export const dynamic = "force-dynamic";

function stats(): LandingStats {
  if (!datasetAvailable) return { cases: 0, fraud: 0, legitimate: 0, uncertain: 0, sars: 0, exposure: 0, needEvidence: 0, patterns: [] };
  const rows = caseIds().map(summary);
  const patterns = new Map<string, number>();
  rows.forEach((r) => r.assessment.pattern && patterns.set(r.assessment.pattern.name, (patterns.get(r.assessment.pattern.name) ?? 0) + 1));
  return {
    cases: rows.length,
    fraud: rows.filter((r) => r.verdict === "fraud").length,
    legitimate: rows.filter((r) => r.verdict === "legitimate").length,
    uncertain: rows.filter((r) => r.verdict === "uncertain").length,
    sars: rows.filter((r) => r.sar).length,
    exposure: rows.reduce((s, r) => s + (r.exposure ?? 0), 0),
    needEvidence: rows.filter((r) => r.needsEvidence).length,
    patterns: Array.from(patterns.entries()).sort((a, b) => b[1] - a[1]),
  };
}

export default function Page() {
  return <Landing stats={stats()} />;
}
