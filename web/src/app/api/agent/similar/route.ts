import { agentFetch } from "@/lib/agentApi";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const u = new URL(req.url);
  return agentFetch(`/similar?q=${encodeURIComponent(u.searchParams.get("q") ?? "")}&k=${u.searchParams.get("k") ?? "6"}`);
}
