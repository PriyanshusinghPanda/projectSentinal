import { answerFile, datasetAvailable } from "@/lib/dataset";

export const dynamic = "force-dynamic";

/** The graded answer file for a case under a given simulated reply (default: the agent's own assumption). */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!datasetAvailable) return Response.json({ error: "dataset bundles not built — run agent/investigate.py" }, { status: 404 });
  const reply = (new URL(req.url).searchParams.get("reply") ?? "agent") as "agent" | "deny" | "confirm";
  try {
    const inline = new URL(req.url).searchParams.get("inline") === "1";
    return new Response(JSON.stringify(answerFile(params.id, reply), null, 2), {
      headers: { "Content-Type": "application/json", ...(inline ? {} : { "Content-Disposition": `attachment; filename="${params.id}.json"` }) },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 404 });
  }
}
