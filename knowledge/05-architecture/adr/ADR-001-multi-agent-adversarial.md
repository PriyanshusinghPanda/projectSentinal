# ADR-001 — Adversarial multi-agent investigation with a deterministic decision core
**Status:** accepted · 2026-09-24

## Context
Judges weight investigation accuracy and next-best-action quality (50%), with an emphasis on how the agent handles uncertainty. LLM-only decisions are hard to audit and are not reproducible.

## Decision
- **Specialists** turn graph signals into findings. Each finding is a log-odds contribution with a confidence and a source (GSQL query or GraphRAG document).
- The **Challenger** attacks findings (travel, corporate NAT, kiosk precedent, split precedents). Upheld disputes discount a finding's weight and lower confidence.
- The **Orchestrator** combines a prior with the confidence-weighted log-odds to get a posterior. Confidence is based on agent agreement, how decisive the posterior is, evidence coverage and the number of disputes. The policy threshold decides between *act* and *gather evidence*. The evidence type is chosen by the pattern it would resolve.
- The **Policy** layer maps the assessment to actions and approval routes. It sets auto-block thresholds, SAR rules and human gates.
- The **LLM** (Claude, optional via `ANTHROPIC_API_KEY`) only narrates the explanation from the structured evidence.

## Consequences
Every decision is reproducible and explainable per finding. It is easy to tune per policy. The LLM cannot hallucinate an action.
