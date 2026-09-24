"""
Export the agent's analytics for the web console → ../web/insights/*.json

  python3 export_insights.py

  audit.json       policy_audit results per case
  backtest.json    copied from knowledge/07-testing (run backtest.py first)
  rings.json       TigerGraph ring_components clusters (needs TG_HOST in ../.env)
  monitoring.json  copied from monitoring/summary.json (run monitor.py first)
  rules.json       which exam cases cite which policy rule, initial vs final
"""
import json, os, re, shutil
from glob import glob

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "web", "insights")
os.makedirs(OUT, exist_ok=True)
env = os.path.join(HERE, "..", ".env")
if os.path.exists(env):
    for line in open(env):
        if "=" in line and not line.lstrip().startswith("#"):
            k, v = line.strip().split("=", 1)
            os.environ.setdefault(k, v)

import policy_audit  # noqa: E402

answers = [json.load(open(f)) for f in sorted(glob(os.path.join(HERE, "..", "cases", "*.json")))]
json.dump({a["case_id"]: policy_audit.audit(a) for a in answers}, open(os.path.join(OUT, "audit.json"), "w"), indent=1)

rules = {}
for a in answers:
    for stage in ("initial", "final"):
        for x in a["next_best_actions"][stage]:
            for r in set(re.findall(r"R\d+|3a|3b", x["reason"])):
                rules.setdefault(r, {}).setdefault(a["case_id"], set()).add(f"{stage}: {x['action']}")
json.dump({r: {c: sorted(v) for c, v in cs.items()} for r, cs in rules.items()}, open(os.path.join(OUT, "rules.json"), "w"), indent=1)

for src, dst in (("../knowledge/07-testing/backtest.json", "backtest.json"), ("../monitoring/summary.json", "monitoring.json")):
    p = os.path.join(HERE, src)
    if os.path.exists(p):
        shutil.copy(p, os.path.join(OUT, dst))

if os.environ.get("TG_HOST"):
    from tg_mcp import TigerGraphMCP
    m = TigerGraphMCP()
    res = m.query("ring_components", from_ts="2016-07-01 00:00:00", to_ts="2016-12-31 23:59:59")
    m.close()
    comps = res[1]
    rings = []
    for cid, custs in comps["customers"].items():
        if len(custs) < 3:
            continue
        rings.append({"id": cid, "customers": sorted(custs), "devices": sorted(comps["devices"].get(cid, [])),
                      "txns": comps["txns"].get(cid, 0), "amount": round(comps["amount"].get(cid, 0), 2),
                      "fraud_cases": sorted(comps["fraud_cases"].get(cid, []))})
    rings.sort(key=lambda r: (-len(r["fraud_cases"]), len(r["devices"]), -len(r["customers"])))
    json.dump({"meta": res[0], "components": rings}, open(os.path.join(OUT, "rings.json"), "w"), indent=1)
print("exported:", sorted(os.listdir(OUT)))
