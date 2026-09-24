# Discovery brief
**Problem.** Fraud analysts manually gather transaction history, trace money movement, find connected accounts, check policy, assess risk and document findings. It is slow and fragmented, and it often finishes after the money is gone.
**Users.** Tier-1 fraud analysts (triage and approve), senior compliance (SAR approval).
**Signal.** HHGOA_IEEE: ~590k transactions and ~13.5k customers. Each transaction has a model risk score but no fraud label. Closed cases from months 1–4 serve as memory, with 20 benchmark cases from months 5–6.
**Bet.** A graph-grounded, multi-agent investigator that argues with itself can turn uncertain signals into a defensible action faster. It asks for evidence only when that evidence would change the decision.
