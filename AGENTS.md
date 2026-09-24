# AGENTS.md — Agent Contract (adapted from agentic-engineering-starter-pack)

```
Project:     Sentinel — Agentic Fraud Investigation (TigerGraph HHGOA hackathon)
Description: Multi-agent fraud investigation + next-best-action on TigerGraph, with human approval gates
Status:      build
Created:     2026-09-24
Updated:     2026-09-24
```

## Rules for agents working in this repo
1. Read `knowledge/` before writing. Build on existing artifacts; reference upstream docs.
2. The product is the priority; design follows `knowledge/02-design/design-decisions.md` (tokens, type, motion).
3. The LLM narrates and selects tools; it never overrides the deterministic, policy-bound decision in `web/src/lib/engine.ts`.
4. Every recommended action must carry an approval route (`auto` / `analyst` / `senior_compliance`) and a policy reference.
5. Never claim TigerGraph-backed results when running on mock data — the UI indicator must stay honest.
6. Human gates: SAR filing, account restriction, case closure.

## Artifact map
| Stage | Artifact |
|---|---|
| 01 Discovery | `knowledge/01-discovery/discovery-brief.md` |
| 02 Design | `knowledge/02-design/design-decisions.md` |
| 03 PRD | `knowledge/03-prd/prd.md` |
| 05 Architecture | `knowledge/05-architecture/adr/ADR-001-multi-agent-adversarial.md` |
| 06 Build | `web/`, `tigergraph/`, `knowledge/06-sprints/sprint-01.md` |
