import { getCase } from "@/lib/source";
import { caseState, store } from "@/lib/store";
import { datasetAvailable } from "@/lib/dataset";
import { saveDecision } from "@/lib/approvals";

/** Human-in-the-loop gate: analyst / senior compliance approve or reject a recommended action. */
export async function POST(req: Request) {
  const { caseId, actionLabel, route, decision, outcome } = await req.json();
  if (datasetAvailable && /^HHG-\d{3}$/.test(caseId)) {
    const st = caseState(caseId);
    st.approvals[actionLabel] = decision;
    const entry = { ts: new Date().toISOString(), actor: "analyst" as const, entry: `${decision === "approved" ? "Approved" : "Rejected"} ${actionLabel} (${route} route)` };
    st.log.push(entry);
    saveDecision(caseId, actionLabel, { decision, by: route === "L2" ? "fraud manager" : "team lead", at: entry.ts });
    return Response.json({ ok: true, entry, status: st.status });
  }
  let c;
  try {
    c = await getCase(caseId);
  } catch {
    return Response.json({ error: "case not found" }, { status: 404 });
  }
  const st = caseState(caseId);
  st.approvals[actionLabel] = decision;
  const entry = { ts: new Date().toISOString(), actor: "analyst" as const, entry: `${decision === "approved" ? "Approved" : "Rejected"} “${actionLabel}” (${route} route)` };
  st.log.push(entry);
  if (outcome) {
    st.status = outcome === "confirmed_fraud" ? "closed_fraud" : "closed_legit";
    store.closed.unshift({ id: c.id, closedAt: new Date().toISOString().slice(0, 10), pattern: "—", outcome, summary: c.title, features: c.signals, analystDecision: actionLabel });
  }
  return Response.json({ ok: true, entry, status: st.status });
}
