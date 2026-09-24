"""
Load HHGOA_IEEE into TigerGraph (Savanna or Community Edition) in one command.

  cd agent && ../.tgvenv/bin/python load_tigergraph.py            # schema (if missing) + data + queries
  ../.tgvenv/bin/python load_tigergraph.py --reset                 # drop and recreate the graph first
  ../.tgvenv/bin/python load_tigergraph.py --only-queries          # just (re)install the GSQL queries

Credentials come from ../.env (git-ignored) or the environment — the same TG_* variables tigergraph-mcp uses:
  TG_HOST, TG_GRAPHNAME (default Sentinel), TG_USERNAME / TG_PASSWORD, or TG_SECRET, or TG_API_TOKEN, TG_TGCLOUD=true
Prerequisite: python3 ../tigergraph/prepare_data.py (writes ../tigergraph/load_data/*.csv).
"""
import argparse, os, sys, tempfile, time

HERE = os.path.dirname(os.path.abspath(__file__))
TG = os.path.join(HERE, "..", "tigergraph")
DATA = os.path.join(TG, "load_data")
CHUNK = 8_000_000  # bytes per upload request


def load_env():
    path = os.path.join(HERE, "..", ".env")
    if os.path.exists(path):
        for line in open(path):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


# loading-job file variable -> csv (see loading_job.gsql); vertices before edges
FILES = [
    ("f_customer", "customer.csv"), ("f_card", "card.csv"), ("f_transaction", "transaction.csv"),
    ("f_device_profile", "device_profile.csv"), ("f_email_domain", "email_domain.csv"), ("f_billing_region", "billing_region.csv"),
    ("f_closed_case", "closed_case.csv"), ("f_case_card", "case_card.csv"), ("f_policy_chunk", "policy_chunk.csv"),
    ("f_owns", "owns.csv"), ("f_made", "made.csv"), ("f_from_device", "from_device.csv"), ("f_purchaser_email", "purchaser_email.csv"),
    ("f_billed_in", "billed_in.csv"), ("f_next", "next.csv"), ("f_involves", "involves.csv"), ("f_on_card", "on_card.csv"),
    ("f_connected_to", "connected_to.csv"), ("f_case_customer", "case_customer.csv"), ("f_card_of", "card_of.csv"),
]


def connect():
    from pyTigerGraph import TigerGraphConnection

    host = os.environ.get("TG_HOST")
    if not host:
        sys.exit("TG_HOST is not set — put your Savanna details in ../.env (see this file's docstring)")
    graph = os.environ.get("TG_GRAPHNAME", "Sentinel")
    conn = TigerGraphConnection(
        host=host, graphname=graph,
        username=os.environ.get("TG_USERNAME", "tigergraph"), password=os.environ.get("TG_PASSWORD", "tigergraph"),
        gsqlSecret=os.environ.get("TG_SECRET", ""), apiToken=os.environ.get("TG_API_TOKEN", ""),
        tgCloud=os.environ.get("TG_TGCLOUD", "true").lower() == "true",
    )
    print(f"connected to {host} (graph {graph}) — TigerGraph {safe(conn.getVer)}")
    return conn, graph


def safe(fn, *a, **k):
    try:
        return fn(*a, **k)
    except Exception as e:  # noqa: BLE001 — report and continue
        return f"<{type(e).__name__}: {e}>"


def gsql_file(conn, name, graph=None):
    text = open(os.path.join(TG, name)).read()
    try:
        out = conn.gsql(text, graphname=graph) if graph else conn.gsql(text)
    except Exception as e:  # pyTigerGraph 2.x raises on some successful DDL responses; judge by the text
        out = str(e)
    out = out if isinstance(out, str) else str(out)
    print(f"--- {name}\n{out.strip()[-1500:]}")
    import re
    if re.search(r"Semantic Check Fails|Syntax Error|Failed to|failed: [1-9]", out):
        sys.exit(f"GSQL errors in {name} — see output above")
    return out


def token(conn):
    if os.environ.get("TG_API_TOKEN"):
        return
    secret = os.environ.get("TG_SECRET") or safe(conn.createSecret)
    if isinstance(secret, str) and not secret.startswith("<"):
        conn.getToken(secret)


def upload(conn, tag, filename):
    path = os.path.join(DATA, filename)
    size = os.path.getsize(path)
    header, sent, loaded = None, 0, 0
    with open(path, "rb") as f:
        header = f.readline()
        while True:
            body = f.read(CHUNK)
            if not body:
                break
            body += f.readline()  # finish the current row
            with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
                tmp.write(body)  # REST uploads ignore header="true", so never send the header line
            for attempt in range(3):
                try:
                    res = conn.runLoadingJobWithFile(tmp.name, tag, "load_sentinel", timeout=600_000)
                    break
                except Exception as e:  # noqa: BLE001
                    if attempt == 2:
                        raise
                    print(f"    retry {filename}: {e}")
                    time.sleep(3)
            os.unlink(tmp.name)
            sent += len(body)
            try:
                loaded += res[0]["statistics"]["parsingStatistics"]["fileLevel"]["validLine"]
            except (TypeError, KeyError, IndexError):
                print(f"    unexpected response: {str(res)[:300]}")
    print(f"  {filename}: {loaded:,} rows loaded ({size / 1e6:.1f} MB)", flush=True)
    return loaded


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="drop the graph and everything in it first")
    ap.add_argument("--only-queries", action="store_true")
    args = ap.parse_args()
    load_env()
    if not os.path.exists(os.path.join(DATA, "transaction.csv")):
        sys.exit("load files missing — run: python3 ../tigergraph/prepare_data.py")
    conn, graph = connect()

    if not args.only_queries:
        existing = str(safe(conn.gsql, "ls"))
        if args.reset and f"Graph {graph}" in existing:
            print(conn.gsql(f"USE GRAPH {graph}\nDROP QUERY ALL\nDROP JOB ALL\nUSE GLOBAL\nDROP GRAPH {graph} CASCADE"))
            existing = ""
        if f"Graph {graph}" not in existing:
            gsql_file(conn, "schema.gsql")
        else:
            print(f"graph {graph} exists — skipping schema (use --reset to recreate)")
        safe(conn.gsql, f"USE GRAPH {graph}\nDROP JOB load_sentinel")  # idempotent re-runs
        gsql_file(conn, "loading_job.gsql")
        token(conn)
        t0 = time.time()
        expected = {fn: sum(1 for _ in open(os.path.join(DATA, fn))) - 1 for _, fn in FILES}
        short = []
        for tag, fn in FILES:
            got = upload(conn, tag, fn)
            if got < expected[fn]:
                short.append(f"{fn}: {got:,}/{expected[fn]:,}")
        if short:
            print("WARNING — rows rejected (check types / quoting):", "; ".join(short))
        print(f"data loaded in {time.time() - t0:.0f}s")

    gsql_file(conn, "queries.gsql")
    token(conn)
    counts = safe(conn.getVertexCount, "*")
    print("vertex counts:", counts)
    print("next: cd agent && TG_MCP_COMMAND=../.tgvenv/bin/tigergraph-mcp python3 investigate.py   (writes cases into the graph)")


if __name__ == "__main__":
    main()
