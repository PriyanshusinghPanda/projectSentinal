"""
Sentinel investigator for the HHGOA_IEEE case pack.

Runs every case in data/case_pack.csv against the real transactions / identity / closed-case data, applies the
bank's Fraud Policy v1.0 (rules R1-R10, exact action ids and approval routes), and writes one answer file per case
to ../cases/<case_id>.json in the README's Answer Format.

Agent loop per case (same roles as the web console):
  Graph/Transaction/Device specialists -> signals from the card profile, device profile, region, and cross-customer links
  Case Memory -> similar closed cases (same customer/card, same device profile, same pattern)
  Challenger -> benign explanations (trip, recurring charge, common device, history fits)
  Orchestrator -> fraud probability, pattern, stop / request evidence, initial + final next best actions per policy

Customer / analyst replies are not provided by the dataset (README section 5): the agent simulates them and records
the assumption in evidence_requests.

  python3 slim.py            # once: caches the needed columns (~10s)
  python3 investigate.py     # writes ../cases/*.json
"""
import csv, json, os, pickle, statistics, sys, time
from collections import Counter, defaultdict
from datetime import datetime, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
OUT = os.path.join(HERE, "..", "cases")
UI_OUT = os.path.join(HERE, "..", "web", "case_bundles")
os.makedirs(OUT, exist_ok=True)

d = pickle.load(open(os.path.join(HERE, "slim.pkl"), "rb"))
TC = {c: i for i, c in enumerate(d["T_COLS"])}
IC = {c: i for i, c in enumerate(d["I_COLS"])}


def ts(s):
    return datetime.strptime(s, "%Y-%m-%d %H:%M:%S")


class Txn:
    __slots__ = ("id", "t", "amt", "prod", "card", "addr1", "addr2", "pemail", "remail", "M", "cust", "channel", "risk", "dev", "dev_new", "proxy", "dist1")

    def __init__(self, r):
        g = lambda c: r[TC[c]]
        self.id = g("TransactionID")
        self.t = ts(g("ts"))
        self.amt = float(g("TransactionAmt") or 0)
        self.prod = g("ProductCD")
        self.card = tuple(g(c) for c in ["card1", "card2", "card3", "card4", "card5", "card6"])
        self.addr1 = g("addr1")
        self.addr2 = g("addr2")
        self.pemail = g("P_emaildomain")
        self.remail = g("R_emaildomain")
        self.M = tuple(g(f"M{i}") for i in range(1, 10))
        self.cust = g("customer_id")
        self.channel = g("channel")
        self.risk = float(g("risk_score") or 0)
        self.dist1 = g("dist1")
        self.dev = ""
        self.dev_new = False
        self.proxy = ""


t0 = time.time()
TX = {}
BY_CUST = defaultdict(list)
for r in d["tx"]:
    x = Txn(r)
    TX[x.id] = x
    BY_CUST[x.cust].append(x)
for v in BY_CUST.values():
    v.sort(key=lambda x: x.t)
BY_DEV = defaultdict(list)
for r in d["id"]:
    x = TX.get(r[IC["TransactionID"]])
    if not x:
        continue
    prof = " | ".join(p for p in [r[IC["DeviceInfo"]], r[IC["id_30"]], r[IC["id_31"]], r[IC["id_33"]]] if p)
    x.dev = prof
    x.dev_new = r[IC["id_15"]] == "New"
    x.proxy = r[IC["id_23"]].replace("IP_PROXY:", "").lower()
    if prof:
        BY_DEV[prof].append(x)
for v in BY_DEV.values():
    v.sort(key=lambda x: x.t)
DEV_CUSTS = {p: len({x.cust for x in v}) for p, v in BY_DEV.items()}

CLOSED = list(csv.DictReader(open(os.path.join(DATA, "closed_cases_history.csv"))))
CC_BY_TXN = defaultdict(list)
CC_BY_CUST = defaultdict(list)
for c in CLOSED:
    for t in c["txn_ids"].split("|"):
        if t:
            CC_BY_TXN[t].append(c)
    CC_BY_CUST[c["customer_id"]].append(c)
TXN_TO_CARD = {}
for c in CLOSED:
    for t in c["txn_ids"].split("|"):
        TXN_TO_CARD[t] = c["card_id"]
CASES = list(csv.DictReader(open(os.path.join(DATA, "case_pack.csv"))))

# Backtesting: when set (YYYY-MM-DD HH:MM:SS), case memory only shows cases closed before this moment.
MEMORY_AS_OF = None


def visible(c):
    return MEMORY_AS_OF is None or c["closed_at"] < MEMORY_AS_OF
for c in CASES:
    TXN_TO_CARD[c["flagged_txn_id"]] = c["card_id"]
print(f"loaded {len(TX)} txns, {len(BY_DEV)} device profiles, {len(CLOSED)} closed cases in {time.time()-t0:.1f}s", file=sys.stderr)

ROUTE = {"ALLOW_TRANSACTION": "auto", "MONITOR_CARD": "auto", "MONITOR_CONNECTED_CARDS": "auto", "WARN_CUSTOMER": "auto", "VERIFY_WITH_CUSTOMER": "auto",
         "STEP_UP_AUTH": "auto", "GENERATE_REPORT": "auto", "CREATE_CASE": "auto", "ESCALATE_TO_ANALYST": "auto", "CLOSE_NO_FRAUD": "auto",
         "DECLINE_TRANSACTION": "L1", "BLOCK_ALL_CARDS": "L2", "FILE_REPORT": "L2"}


def act(a, reason, exposure=0.0):
    route = ("L1" if exposure <= 2500 else "L2") if a == "BLOCK_CARD" else ROUTE[a]
    return {"action": a, "route": route, "reason": reason}


def money(v):
    return f"${v:,.2f}"


def investigate(case, assume=None):
    """assume: None = agent picks the likelier reply; "deny" / "confirm" = force the simulated customer reply."""
    start = time.time()
    calls = 0
    f = TX[case["flagged_txn_id"]]
    card_id, cust = case["card_id"], case["customer_id"]
    trig = case["trigger_type"]
    evidence, notes = [], []

    # ── Transaction analyst: this card's profile (same card fields within the customer) ──
    calls += 1
    prof = [x for x in BY_CUST[cust] if x.card == f.card]
    hist = [x for x in prof if x.t < f.t - timedelta(hours=72)]
    near = [x for x in prof if f.t - timedelta(hours=72) <= x.t <= f.t + timedelta(hours=6)]
    hist_amts = [x.amt for x in hist] or [f.amt]
    med = statistics.median(hist_amts)
    p95 = sorted(hist_amts)[int(0.95 * (len(hist_amts) - 1))]
    hist_prods = Counter(x.prod for x in hist)
    home = Counter(x.addr1 for x in hist if x.addr1)
    online_hist = sum(1 for x in hist if x.channel == "online")

    # card testing: >=3 small online auths within 1h, then a larger purchase (R5)
    small = [x for x in near if x.channel == "online" and x.amt <= 5 and x.t <= f.t and x.t >= f.t - timedelta(hours=1)]
    testing = len(small) >= 3 and f.amt > 5
    if not testing:
        # the flagged txn may itself be one of the probes; look for a burst around it
        around = [x for x in near if x.channel == "online" and x.amt <= 5 and abs((x.t - f.t).total_seconds()) <= 3600]
        larger = [x for x in near if x.amt > 5 and x.t > max((a.t for a in around), default=f.t) and x.t <= f.t + timedelta(hours=2)]
        if len(around) >= 3 and larger:
            testing, small = True, around
    if not testing:
        # Backtest finding: real probe runs here are sub-$2 authorizations spread over hours to days, interleaved with
        # the larger purchases — not one tight hour. Require ≥2 probes in 72h, a larger online purchase after the first,
        # and that tiny charges are unusual for this card.
        probes = [x for x in prof if x.channel == "online" and x.amt <= 1.0 and f.t - timedelta(hours=72) <= x.t <= f.t + timedelta(hours=6)]
        usual_tiny = sum(1 for x in hist if x.amt <= 1.0) / max(1, len(hist))
        window_online = sum(1 for x in prof if x.channel == "online" and f.t - timedelta(hours=72) <= x.t <= f.t + timedelta(hours=6))
        if len(probes) >= 1 and usual_tiny < 0.05 and window_online <= 25:  # a lone tiny charge on a very busy profile is noise
            first = min(x.t for x in probes)
            big = [x for x in prof if x.channel == "online" and x.amt >= 20 and first < x.t <= f.t + timedelta(hours=6)]
            if big:
                testing, small = True, probes
    # threshold structuring (undocumented, CC-3748 family): several online purchases just under $500 within ~1h
    struct = [x for x in near if x.channel == "online" and 450 <= x.amt < 500 and abs((x.t - f.t).total_seconds()) <= 3600]
    structuring = len(struct) >= 3
    # CNP burst: 2-4 online purchases in 48h that don't fit history
    burst = [x for x in near if x.channel == "online" and abs((x.t - f.t).total_seconds()) <= 48 * 3600 and (x.amt > max(p95, 2 * med) or x.prod not in hist_prods)]
    unusual_amt = f.amt > max(p95, 3 * med) if len(hist) >= 5 else f.amt > 300
    # near-identical online charges in a short window (pattern 2 burst)
    twins = [x for x in near if x.channel == "online" and abs((x.t - f.t).total_seconds()) <= 2 * 3600 and abs(x.amt - f.amt) <= max(0.02 * f.amt, 1)]
    new_prod = f.prod not in hist_prods and len(hist) >= 5

    # ── Device & identity ──
    calls += 1
    dev_new = f.dev_new
    proxy = f.proxy in ("anonymous", "hidden")
    m_mismatch = sum(1 for m in f.M[3:6] if m == "F") + (1 if f.M[3] in ("M2",) else 0)
    card_devs_before = {x.dev for x in hist if x.dev}
    unseen_dev = bool(f.dev) and f.dev not in card_devs_before and online_hist >= 3

    # ── Graph analyst: device profile shared across customers in a window (R6 / undocumented ring) ──
    calls += 1
    shared_custs, shared_txns = set(), []
    if f.dev and DEV_CUSTS.get(f.dev, 0) <= 200:
        for x in BY_DEV[f.dev]:
            if abs((x.t - f.t).days) <= 31 and x.cust != cust:
                shared_custs.add(x.cust)
                shared_txns.append(x)
    dev_fraud_cases = sorted({c["case_id"] for x in BY_DEV.get(f.dev, []) for c in CC_BY_TXN.get(x.id, []) if c["outcome"] == "confirmed_fraud" and visible(c)}) if f.dev and DEV_CUSTS.get(f.dev, 0) <= 200 else []
    # Ring = one actor, one device, many cardholders: a device NEW to this account, behind an anonymous/hidden proxy,
    # shared across customers. (Backtest: the looser "shared + prior fraud" rule mislabelled ~300 ordinary CNP cases.)
    ring = bool(f.dev) and dev_new and proxy and len(shared_custs) >= 3

    # ── Region: out-of-region card-present use while home activity continues (pattern 4) ──
    calls += 1
    new_region = f.channel == "in_person" and f.addr1 and len(home) >= 3 and home.get(f.addr1, 0) == 0
    trip = False
    home_continues = False
    if new_region:
        same_region = [x for x in prof if x.addr1 == f.addr1 and abs((x.t - f.t).days) <= 5]
        days_in_region = len({x.t.date() for x in same_region})
        top_home = home.most_common(1)[0][0]
        home_continues = any(x.addr1 == top_home and abs((x.t - f.t).total_seconds()) <= 36 * 3600 and x.channel == "in_person" for x in prof if x.id != f.id)
        trip = days_in_region >= 3 and not home_continues

    # recurring charge (R7): same product, amount within 2%, roughly monthly
    recurring = [x for x in hist if x.prod == f.prod and abs(x.amt - f.amt) <= 0.01]
    gaps = [(b.t - a.t).days for a, b in zip(recurring, recurring[1:] + [f])]
    recurring_monthly = len(recurring) >= 2 and sum(1 for g in gaps if 25 <= g <= 35) >= 2

    # account takeover: mixed channel in 48h + device/match anomalies
    mixed = {x.channel for x in near if abs((x.t - f.t).total_seconds()) <= 48 * 3600}
    ato = len(mixed) == 2 and (dev_new or unseen_dev) and m_mismatch >= 1

    # ── Case memory ──
    calls += 1
    mem = []
    for c in CC_BY_CUST.get(cust, []):
        if visible(c):
            mem.append((3, c))
    for cid in dev_fraud_cases[:5]:
        mem += [(2, c) for c in CLOSED if c["case_id"] == cid]

    # ── Pattern + probability (Orchestrator) ──
    p = 0.12 if trig == "risk_score" else 0.35
    pattern, desc = "none", ""
    signals = 0
    if testing:
        pattern, p, signals = "card_testing", 0.8, signals + 2
        evidence.append({"claim": f"{len(small)} online authorizations of $5 or less within an hour on this card around the flagged transaction, followed by a larger purchase — a card-testing sequence", "source": "graph", "ref": f"query:card_window(card_id={card_id}, hours=1)", "entity_ids": [x.id for x in small][:8] + [f.id]})
    if structuring:
        pattern, p, signals = "undocumented", max(p, 0.82), signals + 2
        desc = f"{len(struct)} online purchases between $450 and $500 within an hour on one card — amounts appear chosen to stay under a $500 authorization threshold. The same structuring shape appears in confirmed closed cases (e.g. CC-3748, CC-3841) across unrelated customers, so it is a repeated scheme, not a one-off."
        evidence.append({"claim": desc.split(" — ")[0] + " (threshold structuring)", "source": "graph", "ref": f"query:card_window(card_id={card_id}, hours=1)", "entity_ids": [x.id for x in struct]})
        mem += [(2, c) for c in CLOSED if c["case_id"] in ("CC-3748", "CC-3841", "CC-3907") and visible(c)]
    if ring:
        pattern, p, signals = "undocumented", max(p, 0.85), signals + 2
        desc = f"Device profile '{f.dev}'{' behind an anonymous proxy' if proxy else ''} is new to this account and transacted on {len(shared_custs)} other customers' cards within a month; {len(dev_fraud_cases)} closed cases on this profile were confirmed fraud. One actor using one device across many cardholders — a shared-device ring that none of the five documented patterns describes."
        evidence.append({"claim": f"The identity record marks device profile '{f.dev}' as New for this account{', connecting through an ' + f.proxy + ' proxy' if proxy else ''}", "source": "graph", "ref": f"query:device_history(card_id={card_id})", "entity_ids": [f.id]})
        evidence.append({"claim": f"The same device profile transacted on {len(shared_custs)} other customers' cards within 31 days of the alert", "source": "graph", "ref": f"query:device_neighbors(device_profile='{f.dev}', days=31)", "entity_ids": sorted(shared_custs)[:10]})
        if dev_fraud_cases:
            evidence.append({"claim": f"{len(dev_fraud_cases)} closed cases involving this device profile were confirmed fraud: {', '.join(dev_fraud_cases[:6])}", "source": "document", "ref": "closed_cases_history", "entity_ids": dev_fraud_cases[:6]})
    if pattern == "none" and ato:
        pattern, p, signals = "account_takeover", 0.62, signals + 2
        evidence.append({"claim": f"Mixed in-person and online activity within 48h, device {'marked New' if dev_new else 'never seen on this card'}, and {m_mismatch} match-flag anomalies (M4-M6) on the flagged transaction", "source": "graph", "ref": f"query:card_window(card_id={card_id}, hours=48)", "entity_ids": [f.id]})
    if pattern == "none" and f.channel == "online" and (dev_new or unseen_dev) and (unusual_amt or new_prod or proxy):
        pattern, p, signals = "card_not_present_new_device", 0.55 + (0.1 if proxy else 0), signals + 2
        evidence.append({"claim": f"Online purchase from a device {'the identity record marks New' if dev_new else 'never used on this card'} ({f.dev}){', behind an ' + f.proxy + ' proxy' if proxy else ''}", "source": "graph", "ref": f"query:device_history(card_id={card_id})", "entity_ids": [f.id]})
    if pattern == "none" and f.channel == "online" and (unusual_amt or new_prod):
        pattern, p, signals = "card_not_present_fraud", 0.42 + (0.12 if len(burst) >= 2 else 0), signals + 1 + (len(burst) >= 2)
        evidence.append({"claim": f"Online {money(f.amt)} {'is above the card history (median ' + money(med) + ', 95th pct ' + money(p95) + ')' if unusual_amt else ''}{' and ' if unusual_amt and new_prod else ''}{'uses product code ' + f.prod + ' never used on this card' if new_prod else ''}; {len(burst)} unusual online purchases within 48h", "source": "graph", "ref": f"query:card_profile(card_id={card_id}, before={f.t.date()})", "entity_ids": [x.id for x in burst][:6] or [f.id]})
    if pattern == "none" and f.channel == "online" and len(twins) >= 3:
        pattern, p, signals = "card_not_present_fraud", 0.55 + (0.1 if proxy else 0), signals + 1 + proxy
        evidence.append({"claim": f"{len(twins)} near-identical online charges of about {money(f.amt)} within two hours on this card{', behind a ' + f.proxy + ' proxy' if proxy else ''} — a card-not-present burst", "source": "graph", "ref": f"query:card_window(card_id={card_id}, hours=2)", "entity_ids": [x.id for x in twins]})
        burst = twins
    if pattern == "none" and f.channel == "online" and (dev_new or proxy):
        pattern, p, signals = "card_not_present_new_device", 0.35 + (0.1 if proxy else 0), 1
        evidence.append({"claim": f"Online purchase from a device the identity record marks {'New' if dev_new else 'as seen'} for this account ({f.dev}){', behind a ' + f.proxy + ' proxy' if proxy else ''}; amount and product fit the card's history, so this is a single weak signal (people buy new phones)", "source": "graph", "ref": f"query:device_history(card_id={card_id})", "entity_ids": [f.id]})
    # Card-present with match-flag anomalies (patterns 4/5). Learned from the closed-case backtest: M5/M6 = "F"
    # appears on 31–59% of confirmed account-takeover / out-of-region cases but only 4–7% of cleared alerts.
    if pattern == "none" and f.channel == "in_person" and (f.M[4] == "F" or f.M[5] == "F"):
        tot = sum(home.values())
        share = home.get(f.addr1, 0) / tot if tot else 1.0
        flags = ", ".join(f"M{i + 1}={f.M[i]}" for i in (3, 4, 5) if f.M[i])
        evidence.append({"claim": f"Card-present purchase with name/address match anomalies ({flags}) — Vesta's unnamed match features; mismatches appear on most confirmed takeover / out-of-region cases and rarely on cleared alerts", "source": "graph", "ref": f"txn:{f.id}", "entity_ids": [f.id]})
        if (f.addr1 and share < 0.05) or f.M[3] == "M0":
            pattern = "out_of_region_use"
            evidence.append({"claim": f"Billing region {f.addr1 or 'n/a'} accounts for {share:.0%} of this card's history", "source": "graph", "ref": f"query:region_history(card_id={card_id})", "entity_ids": [f.id]})
        else:
            pattern = "account_takeover"
        signals += 1 + bool(f.addr1 and share < 0.05)
        # History: every model-scored alert in the closed cases was cleared, so on a model alert these flags alone are a
        # reason to verify (R1), not to block. A customer dispute is itself a second, independent signal.
        p = 0.45 if trig == "risk_score" else (0.45 if signals <= 1 else 0.62)
    if pattern == "none" and new_region and not trip:
        pattern, p, signals = "out_of_region_use", 0.55 + (0.15 if home_continues else 0), signals + 1 + home_continues
        evidence.append({"claim": f"Card-present purchase in billing region {f.addr1}, where this card has no history (home regions {', '.join(k for k, _ in home.most_common(3))}){'; in-person activity continued in the home region within 36h' if home_continues else ''}", "source": "graph", "ref": f"query:region_history(card_id={card_id})", "entity_ids": [f.id]})

    # Challenger: benign explanations
    challenges = []
    if new_region and trip:
        challenges.append(f"Several days of purchases in region {f.addr1} with no concurrent home activity — a trip, not a clone (pattern 4 guidance)")
        p = min(p, 0.15)
    if recurring_monthly and trig == "customer_report":
        challenges.append(f"The disputed {money(f.amt)} matches {len(recurring)} earlier charges of the same amount and product code in different months — a recurring charge the customer may have forgotten (R7)")
    if pattern == "card_not_present_fraud" and not unusual_amt and not new_prod and len(twins) < 3:
        p = min(p, 0.3)
    if f.dev and DEV_CUSTS.get(f.dev, 0) > 200 and pattern in ("card_not_present_new_device",):
        challenges.append(f"Device profile '{f.dev}' is common ({DEV_CUSTS[f.dev]} customers) — shared use is expected, not evidence of a ring")
        p -= 0.1
    if pattern == "none":
        fits = f"Flagged {money(f.amt)} ({f.channel}, product {f.prod}, region {f.addr1 or 'n/a'}) fits this card's history: median {money(med)}, {len(hist)} prior transactions, region seen {home.get(f.addr1, 0)} times"
        evidence.append({"claim": fits, "source": "graph", "ref": f"query:card_profile(card_id={card_id}, before={f.t.date()})", "entity_ids": [f.id]})
        p = min(p, 0.2 if trig == "risk_score" else 0.35)
    if trig == "risk_score":
        evidence.append({"claim": f"Bank model risk score {f.risk:.2f} on the flagged transaction — treated as a reason to look, not a verdict", "source": "graph", "ref": f"txn:{f.id}", "entity_ids": [f.id]})
    else:
        evidence.append({"claim": case["trigger_text"], "source": "customer" if trig == "customer_report" else "external", "ref": f"trigger:{case['case_id']}", "entity_ids": [f.id]})
    for ch in challenges:
        evidence.append({"claim": "Challenger: " + ch, "source": "graph", "ref": f"query:card_profile(card_id={card_id})", "entity_ids": [f.id]})

    # prior closed cases on this customer inform the view
    prior_fraud = [c for c in CC_BY_CUST.get(cust, []) if c["outcome"] == "confirmed_fraud" and visible(c)]
    prior_clear = [c for c in CC_BY_CUST.get(cust, []) if c["outcome"] == "cleared" and visible(c)]
    if prior_clear and pattern in ("none", "card_not_present_fraud", "out_of_region_use"):
        evidence.append({"claim": f"Customer has {len(prior_clear)} cleared prior alert(s): {prior_clear[-1]['analyst_notes'][:160]}", "source": "document", "ref": f"closed_case:{prior_clear[-1]['case_id']}", "entity_ids": [prior_clear[-1]["case_id"]]})
    p = max(0.02, min(0.97, p))

    # ── Affected transactions / exposure ──
    affected = []
    if pattern == "card_testing":
        affected = sorted({x.id for x in small} | {x.id for x in prof if x.amt > 5 and x.channel == "online" and min(s.t for s in small) <= x.t <= f.t + timedelta(hours=6)} | {f.id}, key=lambda i: TX[i].t)
    elif pattern == "undocumented" and structuring:
        affected = sorted({x.id for x in struct} | {f.id}, key=lambda i: TX[i].t)
    elif pattern == "undocumented" and ring:
        affected = sorted({x.id for x in prof if x.dev == f.dev and abs((x.t - f.t).days) <= 3} | {f.id}, key=lambda i: TX[i].t)
    elif pattern in ("card_not_present_fraud", "card_not_present_new_device", "account_takeover"):
        affected = sorted({x.id for x in burst if (x.dev == f.dev or not f.dev)} | {f.id}, key=lambda i: TX[i].t)[:6]
    elif pattern == "out_of_region_use":
        # only card-present purchases in the same region within 48h that also carry match-flag anomalies
        affected = sorted({x.id for x in prof if x.addr1 == f.addr1 and x.channel == "in_person" and abs((x.t - f.t).total_seconds()) <= 48 * 3600 and (x.M[4] == "F" or x.M[5] == "F")} | {f.id}, key=lambda i: TX[i].t)
    elif trig == "customer_report":
        affected = [f.id]
    cnp_burst = pattern.startswith("card_not_present") and 2 <= len(affected) <= 4  # "a burst of two to four within 48 hours"
    if trig == "customer_report" and pattern not in ("card_testing", "undocumented") and not cnp_burst:
        # the customer disputed one charge; only a clearly linked episode (testing, structuring, ring) widens it
        affected = [f.id]
    exposure = round(sum(abs(TX[i].amt) for i in affected), 2)

    connected_cards = sorted({TXN_TO_CARD[x.id] for x in shared_txns if x.id in TXN_TO_CARD} - {card_id})[:12] if ring else []
    connected_devs = [f.dev] if ring or (pattern in ("card_testing", "card_not_present_new_device") and f.dev) else []
    shared_link = bool(ring)

    # ── Evidence request + simulated response, initial / final NBA (Fraud Policy) ──
    ev_req, initial, final, what_changed, stop = [], [], [], "nothing", ""
    p_initial = round(p, 2)
    single_signal = signals <= 1

    def fraud_final(prob, why):
        acts = []
        if pattern == "card_testing":
            acts.append(act("DECLINE_TRANSACTION", "R5: testing sequence"))
            acts.append(act("BLOCK_CARD", f"R5/R2: purchase over $100 already cleared; exposure {money(exposure)}" if any(TX[i].amt > 100 for i in affected) else f"R2: customer denied; exposure {money(exposure)}", exposure))
        else:
            acts.append(act("BLOCK_CARD", f"R2: {why}; exposure {money(exposure)} {'≤' if exposure <= 2500 else '>'} $2,500", exposure))
        acts.append(act("CREATE_CASE", "R2 / 3a: confirmed fraud"))
        sar = exposure > 1000 or shared_link or pattern == "undocumented"
        if sar:
            acts.append(act("FILE_REPORT", "3a: " + ("exposure exceeds $1,000" if exposure > 1000 else "coordinated / undocumented pattern (R9)" if pattern == "undocumented" else "shared device profile links other customers (R6)")))
        if connected_cards or shared_link:
            acts.append(act("MONITOR_CONNECTED_CARDS", f"R6: cards sharing device profile '{f.dev}'"))
        if pattern == "undocumented":
            acts.append(act("ESCALATE_TO_ANALYST", "R9: undocumented coordinated pattern"))
        return acts, sar

    sar_file = False
    if trig == "customer_report" and assume == "confirm" and not recurring_monthly:
        initial = [act("CREATE_CASE", "3a: customer disputes a charge"), act("DECLINE_TRANSACTION", "R4/R2: hold pending authorizations"), act("VERIFY_WITH_CUSTOMER", "R1: confirm the details of the dispute before any block")]
        ev_req.append({"type": "customer_validation", "asked_after_step": 4, "assumed_response": "Shown the merchant and time, the customer recognises the purchase (made by a household member) and withdraws the dispute"})
        p = 0.1
        final = [act("CLOSE_NO_FRAUD", "R3: customer confirmed the transaction"), act("WARN_CUSTOMER", "Security tip: card shared within the household")]
        what_changed = "The customer withdrew the dispute after verification, so the case closes as legitimate instead of blocking (R3)."
        stop = "Verification settled the question (policy 6)."
    elif trig == "customer_report":
        # the report itself is the customer's denial
        if recurring_monthly and assume != "deny":
            initial = [act("CREATE_CASE", "3a: customer disputes a charge"), act("VERIFY_WITH_CUSTOMER", "R7: disputed charge matches the customer's own recurring pattern"), act("WARN_CUSTOMER", "R7: recurring charge reminder")]
            ev_req.append({"type": "customer_validation", "asked_after_step": 4, "assumed_response": f"Shown the {len(recurring)} earlier identical charges, the customer recognises the recurring subscription and withdraws the dispute"})
            p = 0.08
            final = [act("CLOSE_NO_FRAUD", "R3: customer confirmed the recurring charge"), act("WARN_CUSTOMER", "R7: recurring charge reminder")]
            what_changed = "Customer recognised the recurring charge once shown the history; the dispute is closed as legitimate with a reminder, no block (R7, R3)."
            stop = "Verification settled the question (policy 6)."
        elif pattern == "none":
            # denial with nothing in the graph corroborating it: evidence conflicts (R8)
            initial = [act("CREATE_CASE", "3a: customer disputes a charge"), act("DECLINE_TRANSACTION", "R4/R2: hold pending authorizations"), act("STEP_UP_AUTH", "R1: confirm the account holder before further activity")]
            ev_req.append({"type": "step_up_auth", "asked_after_step": 4, "assumed_response": "Account holder passed step-up and reaffirmed they did not make the purchase and still hold the card"})
            ev_req.append({"type": "analyst_info", "asked_after_step": 6, "assumed_response": "No merchant or device evidence available yet; analyst to review the card-present authorization"})
            p = 0.55
            final = [act("BLOCK_CARD", f"R2: customer denied the transaction; exposure {money(f.amt)} ≤ $2,500", f.amt), act("CREATE_CASE", "R2 / 3a"), act("ESCALATE_TO_ANALYST", "R8: the denial conflicts with graph evidence — the purchase fits the card's own history")]
            what_changed = "Step-up confirmed the genuine cardholder is disputing, so the card is blocked under R2; because nothing in the graph corroborates the denial, the case is escalated under R8 rather than closed as fraud."
            stop = "Denial confirmed but the evidence conflicts; further automated steps won't settle it, so it goes to an analyst (policy 6, R8)."
        else:
            initial = [act("CREATE_CASE", "3a: customer disputes a charge"), act("DECLINE_TRANSACTION", "R4/R2: hold pending authorizations while the denial is confirmed"), act("STEP_UP_AUTH", "R1: confirm the account holder before further activity")]
            ev_req.append({"type": "step_up_auth", "asked_after_step": 4, "assumed_response": "Account holder passed step-up on their registered phone and reaffirmed they did not make the purchase and still hold the card"})
            p = max(p, 0.86 if signals >= 1 or pattern != "none" else 0.8)
            final, sar_file = fraud_final(p, "customer denied the transaction")
            what_changed = "Step-up confirmed the genuine cardholder is the one denying the purchase, which settles unauthorised use; the case moves from hold to block" + (" and a regulatory report" if sar_file else "") + "."
            stop = "Customer denial confirmed through step-up settles the verdict (policy 6); further queries would not change the actions."
    elif pattern == "none" or p <= 0.15:
        initial = [act("ALLOW_TRANSACTION", "Evidence shows the activity fits the card's history; risk score alone is not a verdict (policy 0)"), act("CLOSE_NO_FRAUD", "Fraud probability at or below 0.15 with two independent pieces of evidence")]
        if f.risk >= 0.7:
            initial.insert(1, act("MONITOR_CARD", "High model score: 72h monitoring is cheap and non-intrusive"))
        final = initial
        stop = "Fraud probability at or below 0.15 supported by card history and region/device consistency (policy 6)."
    elif p >= 0.85 and signals >= 2:
        initial, sar_file = fraud_final(p, "strong multi-signal evidence")
        initial.insert(0, act("DECLINE_TRANSACTION", "Stop the flagged authorization first")) if pattern not in ("card_testing",) else None
        if assume == "confirm":
            ev_req.append({"type": "customer_validation", "asked_after_step": 5, "assumed_response": "Customer claims they made the purchases"})
            final = [act("MONITOR_CARD", "Customer claims the activity; keep 72h monitoring"), act("CREATE_CASE", "3a"), act("ESCALATE_TO_ANALYST", "R8: customer confirmation conflicts with strong graph evidence")]
            p = 0.5
            what_changed = "The customer's confirmation conflicts with strong multi-signal graph evidence, so the block is withdrawn and the case escalates to an analyst under R8."
        else:
            ev_req.append({"type": "customer_validation", "asked_after_step": 5, "assumed_response": "Customer states they did not make these purchases"})
            final = initial
            what_changed = "nothing"
        stop = "Probability at or above 0.85 with at least two independent pieces of evidence (policy 6); customer denial confirmed the block."
    else:
        # uncertain: verify first (R1), then decide on the simulated reply
        initial = []
        if pattern == "card_testing":
            initial = [act("DECLINE_TRANSACTION", "R5: testing sequence observed"), act("STEP_UP_AUTH", "R5")]
        elif single_signal and p < 0.7:
            initial = [act("VERIFY_WITH_CUSTOMER", f"R1: single signal, probability {p:.2f} < 0.70 — verify before any block")]
        else:
            initial = [act("DECLINE_TRANSACTION", "Hold the flagged authorization while verifying"), act("VERIFY_WITH_CUSTOMER", "R1/3b: confirm before blocking")]
        if p >= 0.3:
            initial.append(act("CREATE_CASE", "3a: probability at or above 0.30 and evidence requested"))
        deny = (assume == "deny") if assume else p >= 0.5
        ev_req.append({"type": "customer_validation", "asked_after_step": 5,
                       "assumed_response": "Customer states they did not make the purchase and still holds the card" if deny
                       else "Customer confirms they made the purchase" + (" while travelling" if new_region else "")})
        if deny:
            p = max(0.88, p + 0.3)
            final, sar_file = fraud_final(p, "customer denied the transaction")
            what_changed = f"Customer denial raised probability from {p_initial:.2f} to {p:.2f}; the recommendation moves from verification to block" + (" plus a regulatory report" if sar_file else "") + " (R2)."
        else:
            p = min(0.08, p)
            final = [act("CLOSE_NO_FRAUD", "R3: customer confirmed the transaction"), act("ALLOW_TRANSACTION", "R3")]
            what_changed = f"Customer confirmation lowered probability from {p_initial:.2f} to {p:.2f}; the alert closes as legitimate (R3)."
        stop = "The verification response settles the question (policy 6)."

    p = round(p, 2)
    verdict = "fraud" if p >= 0.7 else "legitimate" if p <= 0.2 else "uncertain"
    if verdict == "uncertain" and not affected:
        affected, exposure = [f.id], round(f.amt, 2)
    if verdict == "legitimate":
        affected, exposure, connected_cards, connected_devs = [], 0.0, [], []
        pattern_out, desc = ("none" if pattern != "undocumented" else "none"), ""
    else:
        pattern_out = pattern if pattern != "none" else "card_not_present_fraud" if f.channel == "online" else "out_of_region_use" if new_region else "none"
    if pattern_out != "undocumented":
        desc = ""
    status = "closed_fraud" if verdict == "fraud" else "closed_legitimate" if verdict == "legitimate" else "escalated"

    # similar prior cases: same customer first, then device / pattern peers
    seen, similar = set(), []
    for _, c in sorted(mem, key=lambda z: -z[0]):
        if c["case_id"] not in seen:
            seen.add(c["case_id"]); similar.append(c["case_id"])
    if len(similar) < 2 and pattern_out not in ("none",):
        for c in CLOSED:
            if c["pattern"] == pattern_out and c["outcome"] == "confirmed_fraud" and c["case_id"] not in seen and visible(c):
                similar.append(c["case_id"]); seen.add(c["case_id"])
                if len(similar) >= 3:
                    break
    if len(similar) < 2 and verdict == "legitimate":
        for c in CLOSED:
            if c["outcome"] == "cleared" and c["customer_id"] != cust and ("travel" in c["analyst_notes"].lower()) == bool(new_region) and c["case_id"] not in seen and visible(c):
                similar.append(c["case_id"]); seen.add(c["case_id"])
                if len(similar) >= 2:
                    break
    similar = similar[:5]
    if similar:
        evidence.append({"claim": f"Case memory: {len(similar)} closed case(s) retrieved — " + "; ".join(f"{c['case_id']} {c['outcome']} ({c['pattern']})" for c in CLOSED if c["case_id"] in similar[:3]), "source": "document", "ref": "closed_cases_history", "entity_ids": similar[:3]})

    sar_file = sar_file and verdict == "fraud" and any(a["action"] == "FILE_REPORT" for a in final)
    dates = sorted(TX[i].t.date().isoformat() for i in affected) or [f.t.date().isoformat()]
    subjects = [cust, card_id] + connected_cards[:6] + (connected_devs[:1])
    sar = {"file": False, "reason": "", "narrative": "", "subjects": [], "total_amount_usd": 0, "activity_dates": []}
    if sar_file:
        tx_list = ", ".join(f"{i} ({money(TX[i].amt)}, {TX[i].t:%Y-%m-%d %H:%M}, {TX[i].channel}, product {TX[i].prod})" for i in affected[:8])
        how = {"card_testing": f"a card-testing sequence: {len(small)} online authorizations of $5 or less within an hour, followed by a larger purchase",
               "undocumented": desc,
               "card_not_present_new_device": f"card-not-present purchases from a device the identity record marks new for this account ({f.dev}){' behind an ' + f.proxy + ' proxy' if proxy else ''}",
               "card_not_present_fraud": "card-not-present purchases inconsistent with the cardholder's amounts and product history",
               "account_takeover": "mixed-channel activity with device and name/address match-flag anomalies, consistent with stolen credentials",
               "out_of_region_use": f"card-present purchases in billing region {f.addr1}, where the card has no history, while activity continued in the home region"}.get(pattern_out, "unauthorized use")
        sar = {
            "file": True,
            "reason": next(a["reason"] for a in final if a["action"] == "FILE_REPORT"),
            "narrative": (
                f"Between {dates[0]} and {dates[-1]}, card {card_id} held by customer {cust} was used for {len(affected)} transaction(s) totaling {money(exposure)} that the bank assesses as unauthorized. "
                f"The transactions were: {tx_list}. "
                f"The activity was identified through {'a customer report' if trig == 'customer_report' else 'an analyst request' if trig == 'analyst_request' else 'a real-time model alert'} on transaction {f.id} opened {case['opened_at']}. "
                f"The activity shows {how}. "
                + (f"The same device profile ({f.dev}) was used on the cards of {len(shared_custs)} other customers within the same month, including cards {', '.join(connected_cards[:5]) or 'not individually identified'}, and appears on confirmed-fraud closed cases {', '.join(dev_fraud_cases[:4])}. " if shared_link else "")
                + f"The cardholder {'reported' if trig == 'customer_report' else 'was contacted and stated'} that they did not make the purchase(s) and remains in possession of the card; identity was confirmed through the bank's verification step. "
                f"Channel: {', '.join(sorted({TX[i].channel for i in affected}))}; billing region code(s): {', '.join(sorted({TX[i].addr1 for i in affected if TX[i].addr1})) or 'not recorded'}. "
                f"The activity is suspicious because it departs from the cardholder's established history (median transaction {money(med)}) and matches {('a coordinated scheme across multiple cardholders' if shared_link or pattern_out == 'undocumented' else 'a known fraud typology')}. "
                f"The card has been recommended for blocking and reissue and a case has been opened; connected cards are under monitoring where applicable."
            ),
            "subjects": subjects,
            "total_amount_usd": exposure,
            "activity_dates": [dates[0], dates[-1]],
        }
    else:
        sar["reason"] = ("3a: verdict is not fraud, no report" if verdict != "fraud" else "3a: fraud confirmed but exposure ≤ $1,000 with no shared device, region cluster, or coordinated pattern — case only")

    summary = {
        "fraud": f"{pattern_out.replace('_', ' ').capitalize()} on card {card_id}: {len(affected)} transaction(s), exposure {money(exposure)}. " + (desc.split(". ")[0].rstrip(".") + ". " if desc else "") + ("Customer denial confirmed the verdict." if ev_req else ""),
        "legitimate": f"Alert on {f.id} ({money(f.amt)}) is consistent with the cardholder's own activity" + (" after the customer confirmed it" if ev_req else "") + ". Closed without customer impact.",
        "uncertain": f"Mixed evidence on {f.id}; escalated with verification pending.",
    }[verdict]

    ans = {
        "case_id": case["case_id"],
        "case": {
            "status": status,
            "verdict": verdict,
            "fraud_probability": p,
            "pattern": pattern_out,
            "pattern_description": desc if pattern_out == "undocumented" else "",
            "affected_txn_ids": affected,
            "first_suspicious_txn_id": affected[0] if affected else "",
            "connected_card_ids": connected_cards,
            "connected_device_profiles": connected_devs,
            "exposure_usd": exposure,
            "evidence": evidence,
            "similar_prior_cases": similar,
            "summary": summary,
            "written_to_graph": False,
            "graph_case_id": "",
        },
        "evidence_requests": ev_req,
        "next_best_actions": {"initial": initial, "final": final or initial, "what_changed": what_changed},
        "sar": sar,
        "stop_reason": stop,
        "tool_calls": calls + len(similar),
        "tokens": 0,
        "latency_s": round(time.time() - start, 3),
    }
    # context for the web console (not part of the graded answer)
    others = sorted(shared_custs)[:8]
    nodes = [{"id": f"card:{card_id}", "kind": "card", "label": card_id, "subject": True},
             {"id": f"cust:{cust}", "kind": "account", "label": cust}]
    edges = [{"from": f"cust:{cust}", "to": f"card:{card_id}", "label": "OWNS"}]
    if f.dev:
        nodes.append({"id": "dev", "kind": "device", "label": f.dev[:34] + ("…" if len(f.dev) > 34 else ""), "flagged": bool(ring)})
        edges.append({"from": f"card:{card_id}", "to": "dev", "label": "FROM_DEVICE" + (" (New)" if dev_new else "")})
        for o in others:
            nodes.append({"id": f"oc:{o}", "kind": "account", "label": o, "flagged": o in {c["customer_id"] for c in CLOSED if c["case_id"] in dev_fraud_cases}})
            edges.append({"from": f"oc:{o}", "to": "dev", "label": "FROM_DEVICE"})
    if f.addr1:
        nodes.append({"id": "reg", "kind": "address", "label": f"region {f.addr1}"})
        edges.append({"from": f"card:{card_id}", "to": "reg", "label": "BILLED_IN" + (" (new)" if new_region else "")})
    if f.pemail:
        nodes.append({"id": "em", "kind": "email", "label": f.pemail})
        edges.append({"from": f"card:{card_id}", "to": "em", "label": "PURCHASER_EMAIL"})
    nodes.append({"id": "prod", "kind": "merchant", "label": f"product {f.prod} · {f.channel}"})
    edges.append({"from": f"card:{card_id}", "to": "prod", "label": f"PAID {money(f.amt)}"})
    for cid in similar[:3]:
        c = next(c for c in CLOSED if c["case_id"] == cid)
        nodes.append({"id": f"cc:{cid}", "kind": "account", "label": f"{cid} ({c['outcome'].replace('_', ' ')})", "flagged": c["outcome"] == "confirmed_fraud"})
        edges.append({"from": f"cust:{cust}" if c["customer_id"] == cust else ("dev" if f.dev and cid in dev_fraud_cases else f"card:{card_id}"), "to": f"cc:{cid}", "label": "SIMILAR_CASE"})
    window = sorted({x.id: x for x in near + [f]}.values(), key=lambda x: x.t)
    window = [x for x in window if abs((x.t - f.t).total_seconds()) <= 36 * 3600][-14:]
    ans["_ui"] = {
        "opened_at": case["opened_at"], "trigger_type": trig, "trigger_text": case["trigger_text"], "flagged_txn_id": f.id,
        "card_id": card_id, "customer_id": cust, "risk_score": f.risk, "amount": f.amt, "channel": f.channel,
        "initial_probability": p_initial,
        "transactions": [{"id": x.id, "ts": x.t.strftime("%m-%d %H:%M"), "amount": x.amt, "product": x.prod, "channel": x.channel, "region": x.addr1, "risk": x.risk, "device_new": x.dev_new, "subject": x.id == f.id, "affected": x.id in affected} for x in window],
        "nodes": nodes, "edges": edges,
        "similar": [{"id": c["case_id"], "outcome": c["outcome"], "pattern": c["pattern"], "notes": c["analyst_notes"][:220]} for c in CLOSED if c["case_id"] in similar],
    }
    return ans


RINGS = {}  # device profile -> component summary, from TigerGraph's ring_components (connected components) algorithm


def load_rings(mcp):
    """Run the WCC ring-detection algorithm once over the whole graph (via MCP) and index components by device."""
    res = mcp.query("ring_components", from_ts="2016-07-01 00:00:00", to_ts="2016-12-31 23:59:59")
    comps = res[1]
    for cid, devs in comps["devices"].items():
        info = {"component": cid, "customers": len(comps["customers"].get(cid, [])), "devices": len(devs),
                "txns": comps["txns"].get(cid, 0), "amount": round(comps["amount"].get(cid, 0), 2),
                "fraud_cases": sorted(comps["fraud_cases"].get(cid, []))}
        for d in devs:
            RINGS[d] = info
    print(f"ring_components: {res[0]['iterations']} iterations over {res[0]['suspicious_txns']} suspicious txns, "
          f"{sum(1 for i in {v['component']: v for v in RINGS.values()}.values() if i['customers'] >= 3)} components with ≥3 customers", file=sys.stderr)


def graph_pass(mcp, case, answers):
    """TigerGraph MCP: corroborate with installed queries, then write the case into the graph (case memory)."""
    f = TX[case["flagged_txn_id"]]
    card_vertex = f"{case['customer_id']}-P" + "|".join(f.card)
    extra, calls = [], 0
    try:
        win = mcp.query("card_window", card=card_vertex, around=f.t.strftime("%Y-%m-%d %H:%M:%S"), hours=48)
        calls += 1
        n = len((win or [{}])[0].get("T", []))
        extra.append({"claim": f"TigerGraph card_window returned {n} transactions on this card within 48h of the alert", "source": "graph", "ref": f"mcp:card_window(card={card_vertex}, hours=48)", "entity_ids": [f.id]})
        if f.dev:
            nb = (mcp.query("device_neighbors", dev=f.dev, around=f.t.strftime("%Y-%m-%d %H:%M:%S"), days=31) or [{}])[0]
            calls += 1
            extra.append({"claim": f"TigerGraph device_neighbors: device profile used by {len(nb.get('customers', []))} customers within 31 days; confirmed-fraud closed cases on it: {', '.join(sorted(nb.get('closed_fraud_cases', []))[:5]) or 'none'}", "source": "graph", "ref": "mcp:device_neighbors(days=31)", "entity_ids": sorted(nb.get("closed_fraud_cases", []))[:5]})
        ring = RINGS.get(f.dev)
        if ring and ring["customers"] >= 3:
            extra.append({"claim": f"Graph algorithm (connected components over new-device + anonymous/hidden-proxy transactions): this device profile sits in a component of {ring['customers']} customers and {ring['devices']} device profile(s) — {ring['txns']} transactions, ${ring['amount']:,.0f}, {len(ring['fraud_cases'])} confirmed-fraud closed case(s)", "source": "graph", "ref": "mcp:ring_components(2016-07-01..2016-12-31)", "entity_ids": ring["fraud_cases"][:6]})
        # GraphRAG: vector search over closed-case analyst notes stored in TigerGraph (agent/embed.py embeddings)
        import embed
        a0 = answers[0]["case"]
        qtext = f"{a0['pattern'].replace('_', ' ')} " + " ".join(e["claim"] for e in a0["evidence"][:4])
        hits = (mcp.query("similar_notes", qv=embed.embed(qtext), k=3) or [{}])[0].get("S", [])
        calls += 1
        if hits:
            extra.append({"claim": "Vector search over 5,565 closed-case notes (GraphRAG, TigerGraph): nearest precedents " + "; ".join(
                f"{h['v_id']} — {h['attributes']['S.outcome'].replace('_', ' ')}, {h['attributes']['S.pattern']} (similarity {h['attributes']['similarity']:.2f})" for h in hits),
                "source": "document", "ref": "mcp:similar_notes(k=3)", "entity_ids": [h["v_id"] for h in hits]})
            for a in answers:
                sp = a["case"]["similar_prior_cases"]
                for h in hits:
                    if h["v_id"] not in sp and len(sp) < 6:
                        sp.append(h["v_id"])
        mem = mcp.query("case_memory", cust=case["customer_id"], device_profile=f.dev)
        calls += 1
        ours = [r for block in (mem or []) for r in block.get("Ours", [])]
        if ours:
            extra.append({"claim": f"Case memory in the graph: {len(ours)} earlier Sentinel investigation(s) on this device profile", "source": "graph", "ref": "mcp:case_memory", "entity_ids": []})
    except Exception as e:
        print(f"  {case['case_id']}: graph queries failed: {e}", file=sys.stderr)
    for a in answers:
        a["case"]["evidence"].extend(extra)
        a["tool_calls"] += calls
    try:
        from tg_mcp import write_case
        gid = write_case(mcp, answers[0], f.id, case["card_id"], case["opened_at"])
        for a in answers:
            a["case"]["written_to_graph"] = True
            a["case"]["graph_case_id"] = gid
        answers[0]["tool_calls"] += 7
    except Exception as e:
        print(f"  {case['case_id']}: graph write-back failed: {e}", file=sys.stderr)


def run_case(case, mcp=None):
    """Full investigation of one alert: the graded answer (agent's own assumption) plus the console bundle
    holding the answer under each simulated reply. With `mcp`, graph evidence + write-back go through TigerGraph."""
    t0 = time.time()
    a = investigate(case)
    ui = a.pop("_ui")
    variants = {"agent": a}
    for alt in ("deny", "confirm"):
        v = investigate(case, alt)
        v.pop("_ui")
        variants[alt] = v
    if mcp:
        graph_pass(mcp, case, [a, variants["deny"], variants["confirm"]])
    for v in variants.values():
        v["latency_s"] = round(time.time() - t0, 3)
    return a, {"context": ui, "variants": variants}


def write_bundle(case_id, bundle):
    os.makedirs(UI_OUT, exist_ok=True)
    json.dump(bundle, open(os.path.join(UI_OUT, f"{case_id}.json"), "w"), indent=1)


def load_env():
    env_file = os.path.join(HERE, "..", ".env")
    if os.path.exists(env_file):  # same TG_* vars tigergraph-mcp reads
        for line in open(env_file):
            if "=" in line and not line.lstrip().startswith("#"):
                k, v = line.strip().split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


if __name__ == "__main__":
    only = sys.argv[1:]
    load_env()
    mcp = None
    if os.environ.get("TG_HOST"):
        from tg_mcp import TigerGraphMCP
        mcp = TigerGraphMCP()
        print("TigerGraph MCP connected", file=sys.stderr)
        try:
            load_rings(mcp)
        except Exception as e:  # noqa: BLE001
            print(f"ring_components unavailable: {e}", file=sys.stderr)
    for case in CASES:
        if only and case["case_id"] not in only:
            continue
        a, bundle = run_case(case, mcp)
        json.dump(a, open(os.path.join(OUT, f"{case['case_id']}.json"), "w"), indent=2)
        write_bundle(case["case_id"], bundle)
        c = a["case"]
        print(f"{a['case_id']}  {case['trigger_type']:<15} {c['verdict']:<10} p={c['fraud_probability']:<5} {c['pattern']:<28} exp={c['exposure_usd']:<9} sar={a['sar']['file']}  "
              f"graph={a['case']['written_to_graph']}  init={[x['action'] for x in a['next_best_actions']['initial']]} final={[x['action'] for x in a['next_best_actions']['final']]}")
    if mcp:
        mcp.close()
