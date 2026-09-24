/** Client for agent/server.py — the live agent running against TigerGraph. */
export const AGENT_URL = process.env.SENTINEL_AGENT_URL ?? "http://127.0.0.1:8765";

export async function agentFetch(path: string, init?: RequestInit) {
  try {
    const r = await fetch(`${AGENT_URL}${path}`, { ...init, cache: "no-store", signal: AbortSignal.timeout(60_000) });
    const body = await r.json();
    return Response.json(body, { status: r.status });
  } catch {
    return Response.json({ error: "The agent API is not running. Start it with: cd agent && python3 server.py" }, { status: 503 });
  }
}
