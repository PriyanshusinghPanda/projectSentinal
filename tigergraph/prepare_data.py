"""
Turn the HHGOA_IEEE files (data/) into CSVs for loading_job.gsql, following schema.gsql.

  python3 prepare_data.py          # -> tigergraph/load_data/*.csv

Streams with the csv module; ~30s for the full 590k transactions.
"""
import csv, os, re, sys
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "data")
OUT = os.path.join(HERE, "load_data")
os.makedirs(OUT, exist_ok=True)
if not os.path.exists(os.path.join(DATA, "transactions.csv")):
    sys.exit("data/transactions.csv not found - unzip the HHGOA_IEEE download into data/")

W = {}


def writer(name, header):
    fh = open(os.path.join(OUT, f"{name}.csv"), "w", newline="")
    w = csv.writer(fh)
    w.writerow(header)
    W[name] = (fh, w)
    return w


def v(x):
    x = (x or "").strip()
    return "" if x.lower() in ("", "nan") else x


# identity: device profile per transaction (DeviceInfo | OS | browser | screen), New flag, proxy
ident = {}
with open(os.path.join(DATA, "identity.csv"), newline="") as f:
    for r in csv.DictReader(f):
        prof = " | ".join(p for p in [v(r["DeviceInfo"]), v(r["id_30"]), v(r["id_31"]), v(r["id_33"])] if p)
        ident[r["TransactionID"]] = (prof, r["id_15"] == "New", v(r["id_23"]).replace("IP_PROXY:", "").lower())
print(f"identity: {len(ident)}")

tx = writer("transaction", ["id", "ts", "amount", "product_cd", "channel", "risk_score", "addr1", "device_new", "proxy"])
card = writer("card", ["id", "card4", "card6"])
cust = writer("customer", ["id"])
dev = writer("device_profile", ["id"])
em = writer("email_domain", ["id"])
reg = writer("billing_region", ["id"])
owns = writer("owns", ["from", "to"])
made = writer("made", ["from", "to"])
fdev = writer("from_device", ["from", "to"])
pem = writer("purchaser_email", ["from", "to"])
bil = writer("billed_in", ["from", "to"])
nxt = writer("next", ["from", "to"])
seen = defaultdict(set)
last_on_card = {}
n = 0
with open(os.path.join(DATA, "transactions.csv"), newline="") as f:
    for r in csv.DictReader(f):
        tid, c = r["TransactionID"], r["customer_id"]
        card_id = f"{c}-P" + "|".join(v(r[k]) for k in ["card1", "card2", "card3", "card4", "card5", "card6"])
        prof, new, proxy = ident.get(tid, ("", False, ""))
        tx.writerow([tid, r["ts"], r["TransactionAmt"], r["ProductCD"], r["channel"], r["risk_score"], v(r["addr1"]), str(new).lower(), proxy])
        if c not in seen["cust"]:
            seen["cust"].add(c); cust.writerow([c])
        if card_id not in seen["card"]:
            seen["card"].add(card_id); card.writerow([card_id, v(r["card4"]), v(r["card6"])]); owns.writerow([c, card_id])
        made.writerow([card_id, tid])
        # NEXT within a card (file is time-ordered)
        if card_id in last_on_card:
            nxt.writerow([last_on_card[card_id], tid])
        last_on_card[card_id] = tid
        if prof:
            if prof not in seen["dev"]:
                seen["dev"].add(prof); dev.writerow([prof])
            fdev.writerow([tid, prof])
        e = v(r["P_emaildomain"])
        if e:
            if e not in seen["em"]:
                seen["em"].add(e); em.writerow([e])
            pem.writerow([tid, e])
        a = v(r["addr1"])
        if a:
            if a not in seen["reg"]:
                seen["reg"].add(a); reg.writerow([a])
            bil.writerow([tid, a])
        n += 1
        if n % 100000 == 0:
            print(f"  {n}")
print(f"transactions: {n}  cards: {len(seen['card'])}  customers: {len(seen['cust'])}  devices: {len(seen['dev'])}")

cc = writer("closed_case", ["id", "outcome", "pattern", "exposure_usd", "actions_taken", "report_filed", "analyst_notes", "opened_at", "closed_at"])
inv = writer("involves", ["from", "to"])
onc = writer("on_card", ["from", "to"])
con = writer("connected_to", ["from", "to"])
ccu = writer("case_customer", ["from", "to"])
ccard = writer("case_card", ["id"])
cardof = writer("card_of", ["from", "to"])
cards = set()


def case_card(cid, customer):
    if cid and cid not in cards:
        cards.add(cid); ccard.writerow([cid]); cardof.writerow([cid, customer or cid.split("-")[0]])


with open(os.path.join(DATA, "closed_cases_history.csv"), newline="") as f:
    for r in csv.DictReader(f):
        cc.writerow([r["case_id"], r["outcome"], r["pattern"], r["exposure_usd"] or 0, r["actions_taken"], r["report_filed"], r["analyst_notes"], r["opened_at"], r["closed_at"]])
        for t in r["txn_ids"].split("|"):
            if t:
                inv.writerow([r["case_id"], t])
        case_card(r["card_id"], r["customer_id"])
        onc.writerow([r["case_id"], r["card_id"]])
        ccu.writerow([r["case_id"], r["customer_id"]])
        for k in [x for x in r["connected_card_ids"].split("|") if x]:
            case_card(k, None)
            con.writerow([r["case_id"], k])
with open(os.path.join(DATA, "case_pack.csv"), newline="") as f:
    for r in csv.DictReader(f):
        case_card(r["card_id"], r["customer_id"])

# policy / patterns from the README -> PolicyChunk (GraphRAG text corpus)
pc = writer("policy_chunk", ["id", "section", "text"])
readme = open(os.path.join(DATA, "README.md")).read()
sections = re.split(r"\n(?=#{2,3} |\*\*R\d+\.|\*\*\d\. )", readme)
for i, sct in enumerate(sections):
    head = sct.strip().splitlines()[0].strip("#* ").strip()[:120] if sct.strip() else f"section {i}"
    body = " ".join(sct.split())
    if len(body) > 40:
        pc.writerow([f"readme#{i}", head, body[:4000]])
for fh, _ in W.values():
    fh.close()
print(f"closed cases done; case cards: {len(cards)}; policy chunks: {len(sections)}  -> {OUT}")
