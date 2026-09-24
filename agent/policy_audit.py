"""
Audit every answer file in ../cases against Fraud Policy v1.0 (data/README.md) and the answer format.

  python3 policy_audit.py            # prints violations; exit code 1 if any

Checks (rule in brackets):
  routes            action → route table; BLOCK_CARD L1 iff exposure ≤ $2,500 [2]
  report            sar.file ⇔ FILE_REPORT in final; FILE_REPORT only for fraud with exposure > $1,000,
                    a shared device / connected card, or an undocumented pattern [3a]
  case              CREATE_CASE when p ≥ 0.30, evidence was requested, or a customer disputes [3a]
  verify-first      no BLOCK_CARD / BLOCK_ALL_CARDS in `initial` when the case rests on a single signal [R1]
  deny / confirm    assumed denial → BLOCK_CARD + CREATE_CASE in final [R2]; confirmation → CLOSE_NO_FRAUD [R3]
  escalate          uncertain verdict with exposure > $500 → ESCALATE_TO_ANALYST [R8]
  undocumented      undocumented pattern → CREATE_CASE + FILE_REPORT + ESCALATE_TO_ANALYST + description [R9]
  block-all         never BLOCK_ALL_CARDS without two compromised cards [R10]
  consistency       legitimate ⇒ no affected txns / exposure / report; exposure = Σ affected; status matches verdict;
                    first_suspicious_txn_id is the earliest affected; final == initial when nothing was requested
"""
import csv, json, os, pickle, sys
from glob import glob

HERE = os.path.dirname(os.path.abspath(__file__))
ROUTE = {"ALLOW_TRANSACTION": "auto", "MONITOR_CARD": "auto", "MONITOR_CONNECTED_CARDS": "auto", "WARN_CUSTOMER": "auto",
         "VERIFY_WITH_CUSTOMER": "auto", "STEP_UP_AUTH": "auto", "GENERATE_REPORT": "auto", "CREATE_CASE": "auto",
         "ESCALATE_TO_ANALYST": "auto", "CLOSE_NO_FRAUD": "auto", "DECLINE_TRANSACTION": "L1", "BLOCK_ALL_CARDS": "L2", "FILE_REPORT": "L2"}

d = pickle.load(open(os.path.join(HERE, "slim.pkl"), "rb"))
C = {c: i for i, c in enumerate(d["T_COLS"])}
AMT = {r[0]: float(r[C["TransactionAmt"]] or 0) for r in d["tx"]}
TS = {r[0]: r[C["ts"]] for r in d["tx"]}
CLOSED = {c["case_id"] for c in csv.DictReader(open(os.path.join(HERE, "..", "data", "closed_cases_history.csv")))}

DENY = ("did not make", "didn't make", "not make", "denies", "deny", "reaffirmed they did not")
CONFIRM = ("confirms they made", "confirm", "recognises", "recognizes", "withdraws", "claims they made")


def audit(a):
    v = []
    c, nba, sar = a["case"], a["next_best_actions"], a["sar"]
    init = [x["action"] for x in nba["initial"]]
    final = [x["action"] for x in nba["final"]]
    exp, p, verdict = c["exposure_usd"], c["fraud_probability"], c["verdict"]

    for stage in ("initial", "final"):
        for x in nba[stage]:
            want = ("L1" if exp <= 2500 else "L2") if x["action"] == "BLOCK_CARD" else ROUTE.get(x["action"])
            if want is None:
                v.append(f"[format] unknown action {x['action']}")
            elif x["route"] != want:
                v.append(f"[2] {stage} {x['action']} routed {x['route']}, policy says {want}")
            if not x.get("reason"):
                v.append(f"[7] {stage} {x['action']} has no reason")

    if sar["file"] != ("FILE_REPORT" in final):
        v.append("[3a] sar.file disagrees with FILE_REPORT in final actions")
    if "FILE_REPORT" in final:
        if verdict != "fraud":
            v.append("[3a] report filed without a fraud verdict")
        elif not (exp > 1000 or c["connected_device_profiles"] or c["connected_card_ids"] or c["pattern"] == "undocumented"):
            v.append("[3a] report filed but no exposure > $1,000 / shared device / connected card / undocumented pattern")
        if not sar["narrative"] or len(sar["narrative"].split(". ")) < 6:
            v.append("[3a] SAR narrative missing or shorter than six sentences")
    elif verdict == "fraud" and (exp > 1000 or c["pattern"] == "undocumented"):
        v.append("[3a] fraud with exposure > $1,000 or undocumented pattern but no report")

    disputed = any("I never made" in e["claim"] for e in c["evidence"])
    if (p >= 0.30 or a["evidence_requests"] or disputed) and "CREATE_CASE" not in init + final:
        v.append("[3a] probability ≥ 0.30 / evidence requested / dispute, but no CREATE_CASE")

    graph_signals = [e for e in c["evidence"] if e["source"] == "graph" and not e["claim"].startswith(("Challenger", "Bank model risk score", "TigerGraph")) and "fits this card" not in e["claim"]]
    if len(graph_signals) <= 1 and any(x in init for x in ("BLOCK_CARD", "BLOCK_ALL_CARDS")):
        v.append("[R1] initial block on a single signal — verify first")

    resp = " ".join(r["assumed_response"].lower() for r in a["evidence_requests"])
    if resp:
        denied = any(k in resp for k in DENY) and "recognises" not in resp and "claims they made" not in resp
        confirmed = not denied and any(k in resp for k in CONFIRM)
        if denied and not ({"BLOCK_CARD", "CREATE_CASE"} <= set(final)):
            v.append("[R2] denial assumed but final lacks BLOCK_CARD + CREATE_CASE")
        if confirmed and "CLOSE_NO_FRAUD" not in final and "ESCALATE_TO_ANALYST" not in final:
            v.append("[R3] confirmation assumed but final lacks CLOSE_NO_FRAUD (or R8 escalation)")
    elif final != init:
        v.append("[3b] final differs from initial although no evidence was requested")

    if verdict == "uncertain" and exp > 500 and "ESCALATE_TO_ANALYST" not in final:
        v.append("[R8] uncertain with exposure > $500 but no escalation")
    if c["pattern"] == "undocumented":
        if not {"CREATE_CASE", "FILE_REPORT", "ESCALATE_TO_ANALYST"} <= set(final):
            v.append("[R9] undocumented pattern needs CREATE_CASE + FILE_REPORT + ESCALATE_TO_ANALYST")
        if len(c["pattern_description"].split()) < 20:
            v.append("[R9] pattern_description too short")
    if "BLOCK_ALL_CARDS" in init + final:
        v.append("[R10] BLOCK_ALL_CARDS used")

    if verdict == "legitimate" and (c["affected_txn_ids"] or exp or sar["file"]):
        v.append("[notes] legitimate verdict must have no affected txns, exposure or report")
    if abs(exp - round(sum(abs(AMT.get(t, 0)) for t in c["affected_txn_ids"]), 2)) > 0.01:
        v.append("[4] exposure_usd ≠ sum of affected transaction amounts")
    if any(t not in AMT for t in c["affected_txn_ids"]) or any(x not in CLOSED for x in c["similar_prior_cases"]):
        v.append("[format] an ID does not exist in the dataset")
    if c["affected_txn_ids"] and c["first_suspicious_txn_id"] != min(c["affected_txn_ids"], key=lambda t: TS[t]):
        v.append("[format] first_suspicious_txn_id is not the earliest affected transaction")
    want_status = {"fraud": {"closed_fraud"}, "legitimate": {"closed_legitimate"}, "uncertain": {"escalated", "open"}}[verdict]
    if c["status"] not in want_status:
        v.append(f"[format] status {c['status']} doesn't match verdict {verdict}")
    if sar["file"] and (not sar["subjects"] or len(sar["activity_dates"]) != 2):
        v.append("[format] SAR subjects / activity_dates incomplete")
    return v


if __name__ == "__main__":
    total = 0
    for f in sorted(glob(os.path.join(HERE, "..", "cases", "*.json"))):
        a = json.load(open(f))
        issues = audit(a)
        total += len(issues)
        print(f"{a['case_id']}: " + ("OK" if not issues else "\n  - " + "\n  - ".join(issues)))
    print(f"\n{total} policy / format violations")
    sys.exit(1 if total else 0)
