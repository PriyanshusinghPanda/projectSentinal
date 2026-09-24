import { agentFetch } from "@/lib/agentApi";
export const dynamic = "force-dynamic";
export async function GET() {
  return agentFetch("/health");
}
