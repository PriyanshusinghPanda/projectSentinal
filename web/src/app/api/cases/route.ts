import { quickAssess } from "@/lib/engine";
import { caseIds, datasetAvailable, datasetMemory, summary } from "@/lib/dataset";
import { listCases, memory, mode, sourceLabel } from "@/lib/source";
import { caseState, store } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const demo = new URL(req.url).searchParams.get("demo") === "1";
  if (datasetAvailable && !demo) {
    return Response.json({
      mode: "dataset",
      source: "HHGOA_IEEE · 20 exam cases",
      cases: caseIds().map((id) => ({ ...summary(id), status: caseState(id).status === "new" ? summary(id).status : caseState(id).status })),
      memory: [...store.closed, ...datasetMemory()],
    });
  }
  const cases = await listCases();
  return Response.json({
    mode,
    source: sourceLabel,
    cases: cases.map((c) => ({
      id: c.id,
      title: c.title,
      trigger: c.trigger,
      customer: c.customer,
      amount: c.transactions.find((t) => t.id === c.subjectTxnId)?.amount ?? 0,
      openedAt: c.openedAt,
      status: caseState(c.id).status,
      assessment: quickAssess(c),
    })),
    memory: [...store.closed, ...memory()],
  });
}
