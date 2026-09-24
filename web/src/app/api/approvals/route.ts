import { approvalItems, saveDecision } from "@/lib/approvals";
import { datasetAvailable } from "@/lib/dataset";
import { caseState } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!datasetAvailable) return Response.json({ items: [] });
  return Response.json({ items: approvalItems() });
}

/** Record an L1/L2 decision. `by` is the approver role shown in the audit trail. */
export async function POST(req: Request) {
  const { caseId, action, decision, by, note } = await req.json();
  if (!caseId || !action || !["approved", "rejected"].includes(decision)) return Response.json({ error: "bad request" }, { status: 400 });
  const d = { decision, by: by || "analyst", at: new Date().toISOString(), note };
  saveDecision(caseId, action, d);
  caseState(caseId).log.push({ ts: d.at, actor: "analyst", entry: `${decision === "approved" ? "Approved" : "Rejected"} ${action} (${d.by})` });
  return Response.json({ ok: true, decision: d });
}
