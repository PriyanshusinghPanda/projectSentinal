import { agentFetch } from "@/lib/agentApi";
import { invalidate } from "@/lib/dataset";
export const dynamic = "force-dynamic";
/** Re-run an exam case live against TigerGraph; the agent refreshes the case bundle the console replays. */
export async function POST(req: Request) {
  const { case_id } = await req.json();
  const res = await agentFetch("/investigate", { method: "POST", body: JSON.stringify({ case_id }), headers: { "Content-Type": "application/json" } });
  if (res.ok) invalidate(case_id);
  return res;
}
