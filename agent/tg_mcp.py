"""
Minimal TigerGraph MCP client (stdlib only): spawns `tigergraph-mcp` over stdio and speaks MCP JSON-RPC.
Credentials come from the TG_* env vars the server documents (TG_HOST, TG_GRAPHNAME, TG_USERNAME, TG_PASSWORD
or TG_API_TOKEN, TG_TGCLOUD). Install the server with: pip install tigergraph-mcp
"""
import json, os, re, shlex, subprocess, threading


class TigerGraphMCP:
    def __init__(self, command=None):
        cmd = command or os.environ.get("TG_MCP_COMMAND", "tigergraph-mcp")
        self.p = subprocess.Popen(shlex.split(cmd), stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, bufsize=1)
        self.n = 0
        self.lock = threading.Lock()
        self.calls = 0
        self._rpc("initialize", {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "sentinel-agent", "version": "1.0"}})
        self._send({"jsonrpc": "2.0", "method": "notifications/initialized"})
        self.graph = os.environ.get("TG_GRAPHNAME", "Sentinel")

    def _send(self, msg):
        self.p.stdin.write(json.dumps(msg) + "\n")
        self.p.stdin.flush()

    def _rpc(self, method, params):
        with self.lock:
            self.n += 1
            rid = self.n
            self._send({"jsonrpc": "2.0", "id": rid, "method": method, "params": params})
            while True:
                line = self.p.stdout.readline()
                if not line:
                    raise RuntimeError("tigergraph-mcp exited")
                msg = json.loads(line)
                if msg.get("id") == rid:
                    if "error" in msg:
                        raise RuntimeError(msg["error"])
                    return msg["result"]

    def tool(self, name, **args):
        """Call a tigergraph-mcp tool; returns its `data` payload (the server wraps results in ```json {...}```)."""
        self.calls += 1
        res = self._rpc("tools/call", {"name": name, "arguments": {"graph_name": self.graph, **args}})
        text = "\n".join(c.get("text", "") for c in res.get("content", []))
        m = re.search(r"```json\n(.*?)\n```", text, re.S)
        body = json.loads(m.group(1)) if m else {"success": not res.get("isError"), "data": text}
        if not body.get("success", True) or res.get("isError"):
            raise RuntimeError(body.get("error") or body.get("summary") or text[:200])
        return body.get("data")

    def query(self, name, **params):
        return self.tool("tigergraph__run_installed_query", query_name=name, params=params).get("result")

    def upsert(self, vertex_type, vertices):
        if vertices:
            return self.tool("tigergraph__add_nodes", vertex_type=vertex_type, vertices=vertices, vertex_id="id")

    def link(self, edge_type, src_type, dst_type, pairs):
        if pairs:
            return self.tool("tigergraph__add_edges", edge_type=edge_type,
                             edges=[{"source_type": src_type, "source_id": s, "target_type": dst_type, "target_id": t} for s, t in pairs])

    def close(self):
        try:
            self.p.stdin.close()
            self.p.wait(timeout=5)
        except Exception:
            self.p.kill()


def write_case(mcp, answer, flagged_txn_id, card_id, opened_at):
    """Persist one investigation as case memory (InvestigationCase + edges). Returns the graph case id."""
    c = answer["case"]
    gid = f"CASE-{answer['case_id']}"
    nba = answer["next_best_actions"]
    mcp.upsert("InvestigationCase", [{
        "id": gid, "status": c["status"], "verdict": c["verdict"], "fraud_probability": c["fraud_probability"], "pattern": c["pattern"],
        "pattern_description": c["pattern_description"], "exposure_usd": c["exposure_usd"], "summary": c["summary"],
        "initial_actions": ", ".join(f"{a['action']}[{a['route']}]" for a in nba["initial"]),
        "final_actions": ", ".join(f"{a['action']}[{a['route']}]" for a in nba["final"]),
        "sar_filed": answer["sar"]["file"], "sar_narrative": answer["sar"]["narrative"], "opened_at": opened_at,
    }])
    mcp.link("FLAGGED", "InvestigationCase", "Transaction", [(gid, flagged_txn_id)])
    mcp.link("AFFECTS", "InvestigationCase", "Transaction", [(gid, t) for t in c["affected_txn_ids"]])
    mcp.link("INV_ON_CARD", "InvestigationCase", "CaseCard", [(gid, card_id)])
    mcp.link("INV_CONNECTED", "InvestigationCase", "CaseCard", [(gid, k) for k in c["connected_card_ids"]])
    mcp.link("INV_DEVICE", "InvestigationCase", "DeviceProfile", [(gid, d) for d in c["connected_device_profiles"]])
    mcp.link("SIMILAR_TO", "InvestigationCase", "ClosedCase", [(gid, k) for k in c["similar_prior_cases"]])
    return gid
