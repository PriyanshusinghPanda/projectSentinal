# Sentinel — Agentic Fraud Investigation on TigerGraph

Seven agents investigate, argue and decide; the analyst approves. Built for the TigerGraph × Hacker House Goa HHGOA_IEEE challenge.

## Layout
| Path | What |
|---|---|
| `cases/` | **The 20 graded answer files** (`HHG-001.json` … `HHG-020.json`), README Answer Format |
| `agent/investigate.py` | The investigator: card / device / region / cross-customer signals, case memory, Challenger, Fraud Policy v1.0 (R1–R10, `auto`/`L1`/`L2`), initial → evidence → final NBA, SAR narratives |
| `agent/tg_mcp.py` | TigerGraph MCP client (stdlib, stdio JSON-RPC) + case write-back into the graph |
| `agent/policy_audit.py` | Checks every answer against Fraud Policy v1.0 (routes, 3a, R1–R10, format) |
| `agent/backtest.py` | Leak-free replay of the 5,565 closed cases — pattern accuracy 62.8% (`knowledge/07-testing/backtest.md`) |
| `agent/monitor.py` | Autonomous monitoring of Nov–Dec beyond the 20 cases → `monitoring/` |
| `agent/embed.py` | Lightweight TF-IDF (hashed, 256-d) embeddings for GraphRAG vector search |
| `tigergraph/algorithms.gsql` | `ring_components`: connected-components ring detection over new-device + proxy transactions |
| `tigergraph/vector.gsql` | `similar_notes`: exact cosine k-NN over closed-case note embeddings stored in TigerGraph |
| `tigergraph/` | `schema.gsql` (README schema + case memory), `prepare_data.py`, `loading_job.gsql`, `queries.gsql` |
| `web/` | Analyst console (Next.js). Replays each real investigation; switch the simulated customer reply to see the NBA change |
| `data/` | The HHGOA_IEEE download (not committed) |

## Run
```bash
# 1. answers (no TigerGraph needed)
cd agent && python3 slim.py && python3 investigate.py          # -> ../cases/*.json and web/case_bundles/

# 2. console
cd web && npm install && npm run dev                           # http://localhost:3100   (demo engine: /?demo=1)

# 3. TigerGraph (Savanna): put TG_HOST / TG_USERNAME / TG_PASSWORD / TG_GRAPHNAME=Sentinel / TG_TGCLOUD=true in .env
python3.12 -m venv .tgvenv && .tgvenv/bin/pip install pyTigerGraph tigergraph-mcp
python3 tigergraph/prepare_data.py                             # -> tigergraph/load_data/*.csv
.tgvenv/bin/python agent/load_tigergraph.py                    # schema + loading job + data + queries
cd agent && python3 investigate.py                             # queries via MCP, writes InvestigationCase vertices
```

## Notes
- `transactions.csv` has no `card_id`; the case pack's `Cxxxxx-K1` cards can't be derived from card fields, so a card's history is the customer's transactions with the same card1–card6 profile. Case-card IDs live as `CaseCard` vertices.
- Customer / analyst replies aren't provided; the agent assumes denial when fraud probability ≥ 0.5, confirmation otherwise, and records it in `evidence_requests`. The console can replay either reply.
- Without `TG_HOST` the investigator runs on the CSVs directly and answer files say `written_to_graph: false`.
