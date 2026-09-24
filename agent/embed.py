"""
Lightweight text embeddings for GraphRAG vector search — no model download, no API key.

TF-IDF over word unigrams + bigrams, feature-hashed into 256 dimensions (md5), log-scaled term frequency, IDF from the
closed-case corpus, L2-normalised. Lexical, not neural: it matches on shared wording, which suits the bank's templated
analyst notes ("Card-present use in a billing region the cardholder had no history in…"). Swap `embed` for a neural
model later without touching the graph schema (only DIM must match the vector attribute).
"""
import hashlib, json, math, os, re

DIM = 256
HERE = os.path.dirname(os.path.abspath(__file__))
IDF_PATH = os.path.join(HERE, "idf.json")
_STOP = set("a an the of on in to and or was were is are for with by at from as this that it be been had has have not no".split())


def tokens(text):
    w = [t for t in re.findall(r"[a-z]+", text.lower()) if t not in _STOP and len(t) > 2]
    return w + [f"{a}_{b}" for a, b in zip(w, w[1:])]


def _bucket(tok):
    return int(hashlib.md5(tok.encode()).hexdigest(), 16) % DIM


def fit_idf(texts):
    df = {}
    for t in texts:
        for tok in set(tokens(t)):
            df[tok] = df.get(tok, 0) + 1
    n = len(texts)
    idf = {tok: math.log((1 + n) / (1 + c)) + 1 for tok, c in df.items()}
    json.dump(idf, open(IDF_PATH, "w"))
    return idf


_idf = None


def embed(text):
    global _idf
    if _idf is None:
        _idf = json.load(open(IDF_PATH))
    v = [0.0] * DIM
    counts = {}
    for tok in tokens(text):
        counts[tok] = counts.get(tok, 0) + 1
    for tok, c in counts.items():
        v[_bucket(tok)] += (1 + math.log(c)) * _idf.get(tok, 1.0)
    norm = math.sqrt(sum(x * x for x in v)) or 1.0
    return [round(x / norm, 6) for x in v]
