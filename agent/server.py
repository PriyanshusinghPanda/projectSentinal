"""
Sentinel agent API — lets the web console run the real agent against TigerGraph.

  python3 server.py            # http://127.0.0.1:8765  (reads ../.env for TG_*)

  GET  /health                  → {"ok", "tigergraph", "rings"}
  POST /investigate {case_id}   → re-runs the investigation live (graph queries + write-back via TigerGraph MCP),
                                  refreshes web/case_bundles/<case_id>.json, returns timing and tool-call counts.
                                  The graded files in cases/ are NOT touched.
  GET  /similar?q=…&k=5         → GraphRAG vector search over closed-case notes stored in TigerGraph

Stdlib only; one MCP session shared behind a lock (TigerGraphMCP serialises calls).
"""
import json, os, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import investigate as inv
import embed

inv.load_env()
MCP = None
LOCK = threading.Lock()
if os.environ.get("TG_HOST"):
    from tg_mcp import TigerGraphMCP
    MCP = TigerGraphMCP()
    try:
        inv.load_rings(MCP)
    except Exception as e:  # noqa: BLE001
        print(f"ring_components unavailable: {e}", file=sys.stderr)
CASES = {c["case_id"]: c for c in inv.CASES}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):  # quieter logs
        sys.stderr.write("%s %s\n" % (self.command, self.path))

    def do_GET(self):
        u = urlparse(self.path)
        if u.path == "/health":
            return self._send(200, {"ok": True, "tigergraph": MCP is not None, "rings": len({v["component"] for v in inv.RINGS.values()})})
        if u.path == "/similar":
            q = parse_qs(u.query)
            text = (q.get("q") or [""])[0].strip()
            k = int((q.get("k") or ["5"])[0])
            if not text:
                return self._send(400, {"error": "q is required"})
            if not MCP:
                return self._send(503, {"error": "TigerGraph is not configured (TG_HOST)"})
            t0 = time.time()
            with LOCK:
                res = MCP.query("similar_notes", qv=embed.embed(text), k=min(max(k, 1), 20))
            hits = [{"id": h["v_id"], "outcome": h["attributes"]["S.outcome"], "pattern": h["attributes"]["S.pattern"],
                     "notes": h["attributes"]["S.analyst_notes"], "similarity": round(h["attributes"]["similarity"], 3)}
                    for h in (res or [{}])[0].get("S", [])]
            return self._send(200, {"query": text, "hits": hits, "ms": round((time.time() - t0) * 1000)})
        return self._send(404, {"error": "not found"})

    def do_POST(self):
        u = urlparse(self.path)
        if u.path != "/investigate":
            return self._send(404, {"error": "not found"})
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        case = CASES.get(body.get("case_id", ""))
        if not case:
            return self._send(404, {"error": "unknown case"})
        t0 = time.time()
        with LOCK:
            calls0 = MCP.calls if MCP else 0
            answer, bundle = inv.run_case(case, MCP)
            calls = (MCP.calls - calls0) if MCP else 0
        inv.write_bundle(case["case_id"], bundle)
        c = answer["case"]
        return self._send(200, {"case_id": case["case_id"], "seconds": round(time.time() - t0, 2), "mcp_calls": calls,
                                "written_to_graph": c["written_to_graph"], "graph_case_id": c["graph_case_id"],
                                "verdict": c["verdict"], "fraud_probability": c["fraud_probability"], "pattern": c["pattern"]})


if __name__ == "__main__":
    port = int(os.environ.get("SENTINEL_AGENT_PORT", "8765"))
    print(f"Sentinel agent API on http://127.0.0.1:{port}  (TigerGraph: {'connected' if MCP else 'not configured'})", file=sys.stderr)
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
