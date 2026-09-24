# PRD — Sentinel
## Must
- Trigger an investigation from a risk score, a customer report or an analyst request.
- Specialist agents (Graph, Transaction, Device & Identity, Case Memory, Policy) gather evidence from TigerGraph via GSQL / MCP and GraphRAG.
- A Challenger agent disputes findings with alternative explanations. The Orchestrator upholds or overrules each dispute.
- Risk (posterior) and **confidence** are computed separately. Below the confidence threshold (policy `actToConfidence` = 0.82) the agent requests the single most discriminating piece of evidence: step-up, customer confirmation, analyst review or merchant inquiry.
- Next best action is recorded **before** and **after** evidence, each action with its approval route and policy reference.
- A SAR is drafted when policy requires it (≥ $5k exposure or an organised pattern) and routed to senior compliance.
- Case memory: similar past cases are retrieved and inform the decision. Closed cases are written back.
- Explanations cover the evidence used, why more evidence was requested and why these actions were chosen.
- Export answer files per case.
## Acceptance
- Ambiguous cases (HHG-2042/43/44/45) stop and request evidence. Clear cases (HHG-2041/46) act immediately.
- Different evidence outcomes lead to different post-evidence actions.
