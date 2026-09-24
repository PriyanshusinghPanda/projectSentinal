import { datasetAvailable, toCase } from "@/lib/dataset";
import { getCase, mode, sourceLabel } from "@/lib/source";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    if (datasetAvailable && /^HHG-\d{3}$/.test(params.id))
      return Response.json({ case: toCase(params.id), mode: "dataset", source: "HHGOA_IEEE · 20 exam cases" });
    return Response.json({ case: await getCase(params.id), mode, source: sourceLabel });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 404 });
  }
}
