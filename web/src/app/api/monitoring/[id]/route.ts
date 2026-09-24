import { monitoringCase } from "@/lib/insights";
export const dynamic = "force-dynamic";
export async function GET(_: Request, { params }: { params: { id: string } }) {
  const c = monitoringCase(params.id);
  return c ? Response.json(c) : Response.json({ error: "not found" }, { status: 404 });
}
