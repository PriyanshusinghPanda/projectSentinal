# Sentinel — Agentic Fraud Investigation on TigerGraph

Seven agents investigate, argue and decide; the analyst approves. Built for the TigerGraph × Hacker House Goa HHGOA_IEEE challenge.

## Layout
| Path | What |
|---|---|
| `cases/` | **The 20 graded answer files** (`HHG-001.json` … `HHG-020.json`), README Answer Format |
| `agent/investigate.py` | The investigator: card / device / region / cross-customer signals, case memory, Challenger, Fraud Policy v1.0 (R1–R10, `auto`/`L1`/`L2`), initial → evidence → final NBA, SAR narratives |
| `agent/tg_mcp.py` | TigerGraph MCP client (stdlib, stdio JSON-RPC) + case write-back into the graph |
| `tigergraph/` | `schema.gsql` (README schema + case memory), `prepare_data.py`, `loading_job.gsql`, `queries.gsql` |
| `web/` | Analyst console (Next.js). Replays each real investigation; switch the simulated customer reply to see the NBA change |
| `data/` | The HHGOA_IEEE download (not committed) |

## Run
```bash
# 1. answers (no TigerGraph needed)
cd agent && python3 slim.py && python3 investigate.py          # -> ../cases/*.json and web/case_bundles/

# 2. console
cd web && npm install && npm run dev                           # http://localhost:3100   (demo engine: /?demo=1)

# 3. TigerGraph (Savanna or Community Edition)
cd tigergraph && python3 prepare_data.py                       # -> load_data/*.csv
gsql schema.gsql && gsql loading_job.gsql                      # then RUN LOADING JOB (see bottom of loading_job.gsql)
gsql queries.gsql
pip install tigergraph-mcp
export TG_HOST=https://<id>.i.tgcloud.io TG_GRAPHNAME=Sentinel TG_USERNAME=... TG_PASSWORD=... TG_TGCLOUD=true
cd ../agent && python3 investigate.py                          # queries via MCP, writes InvestigationCase vertices, sets written_to_graph
```

## Notes
- `transactions.csv` has no `card_id`; the case pack's `Cxxxxx-K1` cards can't be derived from card fields, so a card's history is the customer's transactions with the same card1–card6 profile. Case-card IDs live as `CaseCard` vertices.
- Customer / analyst replies aren't provided; the agent assumes denial when fraud probability ≥ 0.5, confirmation otherwise, and records it in `evidence_requests`. The console can replay either reply.
- Without `TG_HOST` the investigator runs on the CSVs directly and answer files say `written_to_graph: false`.
