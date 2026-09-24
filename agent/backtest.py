"""
Backtest the investigator on the 5,565 closed cases (July–October), whose outcomes are known.

Leak-free: for each case, case memory only contains cases closed before it opened (investigate.MEMORY_AS_OF),
so an alert can never retrieve itself.

  python3 backtest.py            # full run → ../knowledge/07-testing/backtest.md + backtest.json
  python3 backtest.py --limit 500

Reported:
  - separation (ROC AUC) of the agent's PRE-EVIDENCE fraud probability vs the bank model's risk score,
    on model-triggered alerts only (customer reports are nearly all fraud, so the trigger itself would leak)
  - accuracy / precision / recall at the policy's decision points
  - pattern accuracy on confirmed-fraud cases (pattern the agent assigns once fraud is confirmed)
"""
import argparse, json, os, sys, time
from collections import Counter, defaultdict

import investigate as inv

ap = argparse.ArgumentParser()
ap.add_argument("--limit", type=int, default=0)
args = ap.parse_args()


def trigger_of(notes):
    n = notes.lower()
    if "model scored" in n:
        return "risk_score"
    if "analyst" in n and "request" in n:
        return "analyst_request"
    return "customer_report"


def auc(scores, labels):
    """Mann–Whitney ROC AUC with tie handling."""
    pairs = sorted(zip(scores, labels))
    ranks, i = {}, 0
    rank_sum_pos, n_pos = 0.0, sum(labels)
    n_neg = len(labels) - n_pos
    while i < len(pairs):
        j = i
        while j < len(pairs) and pairs[j][0] == pairs[i][0]:
            j += 1
        avg = (i + j + 1) / 2
        rank_sum_pos += avg * sum(l for _, l in pairs[i:j])
        i = j
    return (rank_sum_pos - n_pos * (n_pos + 1) / 2) / max(1, n_pos * n_neg)


def main():
    rows = []
    t0 = time.time()
    cases = inv.CLOSED[: args.limit] if args.limit else inv.CLOSED
    for k, c in enumerate(cases):
        txns = [t for t in c["txn_ids"].split("|") if t in inv.TX]
        if not txns:
            continue
        flagged = max(txns, key=lambda t: inv.TX[t].t)  # the alert fires on the latest transaction in the episode
        trig = trigger_of(c["analyst_notes"])
        case = {"case_id": c["case_id"], "opened_at": c["opened_at"], "trigger_type": trig,
                "trigger_text": c["analyst_notes"][:120] if trig != "customer_report" else f"Customer {c['customer_id']} message: 'I never made this purchase.'",
                "flagged_txn_id": flagged, "card_id": c["card_id"], "customer_id": c["customer_id"], "risk_score": ""}
        inv.MEMORY_AS_OF = c["opened_at"]
        a = inv.investigate(case)
        p0 = a["_ui"]["initial_probability"]
        denied = inv.investigate(case, "deny")
        rows.append({"id": c["case_id"], "trigger": trig, "fraud": c["outcome"] == "confirmed_fraud", "pattern_true": c["pattern"],
                     "p0": p0, "model": inv.TX[flagged].risk, "pattern_pred": denied["case"]["pattern"],
                     "verdict": a["case"]["verdict"], "final": [x["action"] for x in a["next_best_actions"]["final"]]})
        if k % 500 == 0:
            print(f"  {k}/{len(cases)}  {time.time() - t0:.0f}s", file=sys.stderr)
    inv.MEMORY_AS_OF = None

    rs = [r for r in rows if r["trigger"] == "risk_score"]
    res = {"cases": len(rows), "by_trigger": Counter(r["trigger"] for r in rows),
           "fraud_rate_by_trigger": {t: round(sum(r["fraud"] for r in rows if r["trigger"] == t) / max(1, sum(1 for r in rows if r["trigger"] == t)), 3) for t in ("risk_score", "customer_report", "analyst_request")}}
    if rs and 0 < sum(r["fraud"] for r in rs) < len(rs):
        res["risk_score_alerts"] = {
            "n": len(rs), "fraud": sum(r["fraud"] for r in rs),
            "auc_agent_pre_evidence": round(auc([r["p0"] for r in rs], [r["fraud"] for r in rs]), 3),
            "auc_bank_model_score": round(auc([r["model"] for r in rs], [r["fraud"] for r in rs]), 3),
        }
        for name, key, thr in (("agent p0 ≥ 0.5", "p0", 0.5), ("bank score ≥ 0.7", "model", 0.7)):
            tp = sum(1 for r in rs if r[key] >= thr and r["fraud"]); fp = sum(1 for r in rs if r[key] >= thr and not r["fraud"])
            fn = sum(1 for r in rs if r[key] < thr and r["fraud"]); tn = sum(1 for r in rs if r[key] < thr and not r["fraud"])
            res["risk_score_alerts"][name] = {"precision": round(tp / max(1, tp + fp), 3), "recall": round(tp / max(1, tp + fn), 3), "accuracy": round((tp + tn) / len(rs), 3)}
        # would the agent have blocked a cleared customer before asking? (the costly mistake the policy guards against)
        cleared = [r for r in rs if not r["fraud"]]
        res["risk_score_alerts"]["cleared_blocked_without_verification"] = sum(1 for r in cleared if r["p0"] >= 0.85)
    fr = [r for r in rows if r["fraud"]]
    conf = defaultdict(Counter)
    for r in fr:
        conf[r["pattern_true"]][r["pattern_pred"]] += 1
    res["pattern_accuracy_on_confirmed_fraud"] = round(sum(r["pattern_true"] == r["pattern_pred"] for r in fr) / max(1, len(fr)), 3)
    res["pattern_recall"] = {p: {"n": sum(c.values()), "correct": c[p], "recall": round(c[p] / max(1, sum(c.values())), 3), "top_confusions": c.most_common(3)} for p, c in sorted(conf.items())}

    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "knowledge", "07-testing")
    os.makedirs(out, exist_ok=True)
    json.dump(res, open(os.path.join(out, "backtest.json"), "w"), indent=1, default=list)
    print(json.dumps(res, indent=1, default=list))
    print(f"done in {time.time() - t0:.0f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
