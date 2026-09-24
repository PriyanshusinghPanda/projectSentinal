import { investigate } from "@/lib/engine";
import { datasetAvailable, replay } from "@/lib/dataset";
import { narrate, LLM_MODEL } from "@/lib/llm";
import { getCase, outcomeFromResponse, runContext } from "@/lib/source";
import { caseState } from "@/lib/store";
import type { Dispute, Finding, InvestigationEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

const PACE: Partial<Record<InvestigationEvent["type"], number>> = {
  status: 250, agent_start: 260, tool_call: 360, finding: 300, similar_cases: 280, dispute: 520, recommendation: 500, log: 80,
};

const ndjsonHeaders = { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache, no-transform", "Content-Encoding": "none", "X-Accel-Buffering": "no" };

/** Real exam cases: replay the agent's investigation from its bundle, paced like a live run. */
function datasetStream(id: string, reply: string | undefined, url: URL) {
  let fast = url.searchParams.get("fast") === "1" || url.searchParams.get("resume") === "1";
  const stream = new ReadableStream({
    async start(ctrl) {
      const enc = new TextEncoder();
      const st = caseState(id);
      st.log = [];
      try {
        for (const e of replay(id, reply as "agent" | "deny" | "confirm" | undefined)) {
          if (e.type === "status" && e.phase === "evidence") fast = url.searchParams.get("fast") === "1";
          ctrl.enqueue(enc.encode(JSON.stringify(e) + "\n"));
          if (e.type === "log") st.log.push(e.entry);
          if (e.type === "done") st.status = e.caseStatus;
          if (!fast) await new Promise((r) => setTimeout(r, PACE[e.type] ?? 200));
        }
      } catch (err) {
        ctrl.enqueue(enc.encode(JSON.stringify({ type: "status", phase: "error", message: String(err) }) + "\n"));
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: ndjsonHeaders });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const caseId = url.searchParams.get("caseId") ?? "";
  if (datasetAvailable && /^HHG-\d{3}$/.test(caseId)) return datasetStream(caseId, url.searchParams.get("evidence") ?? undefined, url);
  let c;
  try {
    c = await getCase(url.searchParams.get("caseId") ?? "");
  } catch (e) {
    return new Response(String(e), { status: 404 });
  }
  const evidence = url.searchParams.get("evidence") ?? outcomeFromResponse(url.searchParams.get("evidenceText") ?? undefined);
  // resume=1 replays phase 1 instantly (already shown to the analyst) and paces from the evidence step onward
  let fast = url.searchParams.get("fast") === "1" || url.searchParams.get("resume") === "1";
  const ctx = await runContext(c);

  const stream = new ReadableStream({
    async start(ctrl) {
      const enc = new TextEncoder();
      const send = (e: InvestigationEvent) => ctrl.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      const findings: Finding[] = [];
      const disputes: Dispute[] = [];
      const all: InvestigationEvent[] = [];
      const st = caseState(c.id);
      st.log = [];
      try {
        for (const e of investigate(c, { ...ctx, evidenceOutcomeId: evidence ?? undefined })) {
          all.push(e);
          if (e.type === "finding") findings.push(e.finding);
          if (e.type === "dispute") disputes.push(e.dispute);
          if (e.type === "status" && e.phase === "evidence") fast = url.searchParams.get("fast") === "1";
          send(e);
          if (e.type === "log") st.log.push(e.entry);
          if (e.type === "recommendation" && !(fast && e.recommendation.stage === "pre_evidence" && evidence)) {
            const text = await narrate(c, findings, disputes, e.recommendation, ctx.policy);
            if (text) send({ type: "narrative", stage: e.recommendation.stage, text, model: LLM_MODEL });
          }
          if (e.type === "done") st.status = e.caseStatus;
          if (!fast) await new Promise((r) => setTimeout(r, PACE[e.type] ?? 200));
        }
      } catch (err) {
        send({ type: "status", phase: "error", message: String(err) });
      }
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache, no-transform", "Content-Encoding": "none", "X-Accel-Buffering": "no" } });
}
