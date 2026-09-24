import { insight } from "@/lib/insights";
export const dynamic = "force-dynamic";
const ALLOWED = new Set(["audit", "backtest", "rings", "monitoring", "rules"]);
export async function GET(_: Request, { params }: { params: { name: string } }) {
  if (!ALLOWED.has(params.name)) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(insight(params.name, null));
}
