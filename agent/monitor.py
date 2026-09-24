"""
Autonomous monitoring of the exam period (November–December 2016), beyond the 20 case-pack alerts.

  python3 monitor.py [--threshold 0.85] [--top 25]     → ../monitoring/<alert_id>.json + ../monitoring/README.md

1. Scan: every Nov–Dec transaction the bank's model scored ≥ threshold, plus every transaction in a multi-customer
   component found by TigerGraph's ring_components algorithm (when TG_HOST is configured).
2. Triage: run the agent's pre-evidence assessment on each alert (memory cut off at the alert time). Most high
   model scores are legitimate, so the triage ranks by the agent's probability, not the model score.
3. Investigate the top alerts in full and write answer files in the case-pack format (graph write-back via MCP
   when available), plus a summary README.

Per the dataset README these count toward Innovation, not accuracy; they live outside cases/.
"""
import argparse, json, os, sys, time
from collections import Counter

import investigate as inv

ap = argparse.ArgumentParser()
ap.add_argument("--threshold", type=float, default=0.85)
ap.add_argument("--top", type=int, default=25)
args = ap.parse_args()

OUT = os.path.join(inv.HERE, "..", "monitoring")
os.makedirs(OUT, exist_ok=True)
EXAM = {c["flagged_txn_id"] for c in inv.CASES}
START, END = "2016-11-01", "2017-01-01"


def load_env():
    path = os.path.join(inv.HERE, "..", ".env")
    if os.path.exists(path):
        for line in open(path):
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def as_open_alert(a, p0):
    """Monitoring alerts have no customer reply yet: keep the pre-evidence recommendation, mark the reply pending,
    and only call fraud when the pre-evidence evidence is already strong (policy 6: ≥ 0.85)."""
    nba = a["next_best_actions"]
    for r in a["evidence_requests"]:
        r["assumed_response"] = "Pending — verification sent by the monitoring agent; no reply yet"
    nba["final"] = nba["initial"]
    nba["what_changed"] = "nothing yet — awaiting the verification reply"
    c = a["case"]
    c["fraud_probability"] = p0
    c["verdict"] = "fraud" if p0 >= 0.85 else "uncertain"
    c["status"] = "open"
    if c["verdict"] == "uncertain" and not c["affected_txn_ids"]:
        c["affected_txn_ids"] = [a["case_id"].replace("MON-", "")]
        c["first_suspicious_txn_id"] = c["affected_txn_ids"][0]
        c["exposure_usd"] = round(abs(inv.TX[c["affected_txn_ids"][0]].amt), 2)
    if "FILE_REPORT" not in [x["action"] for x in nba["final"]]:
        a["sar"] = {"file": False, "reason": "3a: pending verification — no report until fraud is confirmed or strongly suspected", "narrative": "", "subjects": [], "total_amount_usd": 0, "activity_dates": []}
    a["stop_reason"] = "Monitoring: investigation paused at the verification step until the reply arrives (policy 5)."
    return a


def main():
    t0 = time.time()
    load_env()
    mcp = None
    if os.environ.get("TG_HOST"):
        from tg_mcp import TigerGraphMCP
        mcp = TigerGraphMCP()
        inv.load_rings(mcp)

    period = [x for x in inv.TX.values() if START <= x.t.strftime("%Y-%m-%d") < END and x.id not in EXAM]
    scored = [x for x in period if x.risk >= args.threshold]
    ring_devs = {d for d, r in inv.RINGS.items() if r["customers"] >= 3 and r["devices"] <= 2}  # tight: one actor's device(s)
    ringed = [x for x in period if x.dev in ring_devs]
    cand = {x.id: x for x in scored + ringed}
    print(f"period txns {len(period):,} | model score ≥ {args.threshold}: {len(scored):,} | in ring components: {len(ringed):,} | alerts {len(cand):,}", file=sys.stderr)

    # one alert per card profile per day (the model fires repeatedly on the same episode)
    seen, alerts = set(), []
    for x in sorted(cand.values(), key=lambda x: -x.risk):
        key = (x.cust, x.card, x.t.date())
        if key not in seen:
            seen.add(key)
            alerts.append(x)

    triage = []
    for i, x in enumerate(alerts):
        case = {"case_id": f"MON-{x.id}", "opened_at": x.t.strftime("%Y-%m-%d %H:%M:%S"), "trigger_type": "risk_score",
                "trigger_text": f"Monitoring: model scored transaction {x.id} (${x.amt:,.2f}, {x.channel}) at {x.risk:.2f}" + (" · device in a graph ring component" if x.dev in ring_devs else ""),
                "flagged_txn_id": x.id, "card_id": inv.TXN_TO_CARD.get(x.id, x.cust), "customer_id": x.cust, "risk_score": x.risk}
        inv.MEMORY_AS_OF = case["opened_at"]
        a = inv.investigate(case)
        triage.append((a["_ui"]["initial_probability"], a["case"]["pattern"] if a["case"]["pattern"] != "none" else inv.investigate(case, "deny")["case"]["pattern"], case))
        if i % 500 == 0:
            print(f"  triage {i}/{len(alerts)} {time.time() - t0:.0f}s", file=sys.stderr)
    inv.MEMORY_AS_OF = None

    triage.sort(key=lambda r: -r[0])
    rings = [r for r in triage if r[1] == "undocumented"][: args.top // 2]
    others = [r for r in triage if r[1] != "undocumented"][: args.top - len(rings)]
    top = sorted(rings + others, key=lambda r: -r[0])
    written = []
    for p0, pat, case in top:
        inv.MEMORY_AS_OF = case["opened_at"]
        a = as_open_alert(inv.investigate(case), p0)
        a.pop("_ui")
        variants = [a]
        if mcp:
            inv.graph_pass(mcp, case, variants)
        json.dump(a, open(os.path.join(OUT, f"{case['case_id']}.json"), "w"), indent=2)
        written.append((case, a, p0))
    inv.MEMORY_AS_OF = None
    if mcp:
        mcp.close()

    # summary
    dist = Counter("≥0.70" if p >= 0.7 else "0.30–0.70" if p >= 0.3 else "<0.30" for p, _, _ in triage)
    pats = Counter(pat for p, pat, _ in triage if p >= 0.3)
    lines = [
        "# Autonomous monitoring — November–December 2016",
        "",
        f"Generated by `agent/monitor.py`. Beyond the 20 case-pack alerts; counts toward Innovation, not accuracy.",
        "",
        f"- Transactions in the period (excluding the case pack): **{len(period):,}**",
        f"- Alerts raised: **{len(cand):,}** (model score ≥ {args.threshold}: {len(scored):,}; device in a TigerGraph ring component: {len(ringed):,}), "
        f"deduplicated to **{len(alerts):,}** card-days",
        f"- Agent triage of pre-evidence fraud probability: {dict(dist)} — only {dist['≥0.70'] / max(1, len(triage)):.0%} of alerts reach 0.70 before verification; the rest go to verification (R1) or are cleared",
        f"- Patterns among alerts with probability ≥ 0.30: {dict(pats.most_common())}",
        "",
        f"## Top {len(written)} investigated (full answer files in this folder)",
        "",
        "| Alert | Opened | Flagged txn | Amount | Model score | Agent p (pre-evidence) | Pattern | Verdict | Final actions |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    for case, a, p0 in written:
        x = inv.TX[case["flagged_txn_id"]]
        lines.append(f"| {case['case_id']} | {case['opened_at'][:16]} | {x.id} | ${x.amt:,.2f} | {x.risk:.2f} | {p0:.2f} | {a['case']['pattern']} | {a['case']['verdict']} | "
                     + ", ".join(f"{y['action']} ({y['route']})" for y in a["next_best_actions"]["final"]) + " |")
    open(os.path.join(OUT, "README.md"), "w").write("\n".join(lines) + "\n")
    json.dump({
        "period_txns": len(period), "threshold": args.threshold, "alerts": len(cand), "model_alerts": len(scored),
        "ring_alerts": len(ringed), "card_days": len(alerts), "triage": dict(dist), "patterns": dict(pats.most_common()),
        "investigated": [{"id": c["case_id"], "opened_at": c["opened_at"], "txn": c["flagged_txn_id"], "amount": inv.TX[c["flagged_txn_id"]].amt,
                          "model_score": inv.TX[c["flagged_txn_id"]].risk, "p0": p0, "pattern": a["case"]["pattern"], "verdict": a["case"]["verdict"],
                          "status": a["case"]["status"], "ring": inv.TX[c["flagged_txn_id"]].dev in ring_devs,
                          "actions": [f"{y['action']} ({y['route']})" for y in a["next_best_actions"]["final"]]} for c, a, p0 in written],
    }, open(os.path.join(OUT, "summary.json"), "w"), indent=1)
    print(f"wrote {len(written)} investigations + README in {time.time() - t0:.0f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
