"use client";
import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Card, PanelHeader, cn } from "./ui";

type Hit = { id: string; outcome: string; pattern: string; notes: string; similarity: number };
const EXAMPLES = ["several online purchases just under a $500 limit", "same phone used by many cardholders behind a proxy", "cardholder was travelling in another region", "tiny authorizations then a larger purchase"];

/** GraphRAG over case memory: plain-language search against closed-case notes embedded in TigerGraph. */
export function SemanticSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [meta, setMeta] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function search(text: string) {
    if (!text.trim()) return;
    setQ(text);
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/agent/similar?q=${encodeURIComponent(text)}&k=6`);
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(d.error ?? "Search failed");
    setHits(d.hits);
    setMeta(`TigerGraph similar_notes · ${d.ms} ms`);
  }
  return (
    <Card className="mb-6">
      <PanelHeader title="Ask case memory" right={meta && <span className="font-mono text-[11px] font-normal text-muted-foreground">{meta}</span>} />
      <div className="p-4">
        <form onSubmit={(e) => { e.preventDefault(); search(q); }} className="flex gap-2">
          <div className="flex h-10 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3 focus-within:border-accent/60">
            <Search size={15} className="text-subtle" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Describe what you're seeing — the agent finds the closest past investigations" className="h-full flex-1 bg-transparent text-[14px] outline-none" />
          </div>
          <button type="submit" disabled={busy} className="flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground disabled:opacity-50">
            {busy && <Loader2 size={13} className="animate-spin" />} Search
          </button>
        </form>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button key={e} onClick={() => search(e)} className="rounded-full border border-border px-2.5 py-1 text-[12px] text-muted-foreground hover:border-foreground/30 hover:text-foreground">
              {e}
            </button>
          ))}
        </div>
        {err && <p className="mt-3 text-[13px] text-risk-critical">{err}</p>}
        {hits && (
          <div className="mt-4 divide-y divide-border/60 border-t border-border">
            {hits.map((h) => (
              <div key={h.id} className="grid grid-cols-[90px_1fr_70px] gap-4 py-3 text-[13px]">
                <div>
                  <div className="font-mono text-xs">{h.id}</div>
                  <div className={cn("mt-1 text-[11px]", h.outcome === "confirmed_fraud" ? "text-risk-critical" : "text-risk-low")}>{h.outcome.replace("_", " ")}</div>
                </div>
                <div>
                  <div className="text-[12px] text-muted-foreground">{h.pattern.replace(/_/g, " ")}</div>
                  <div className="mt-0.5 leading-5">{h.notes}</div>
                </div>
                <div className="text-right font-mono text-xs tabular-nums text-confidence">{h.similarity.toFixed(2)}</div>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11.5px] text-subtle">Embeddings: TF-IDF over word unigrams and bigrams, hashed to 256 dimensions (agent/embed.py) — lexical, not neural. Stored on ClosedCase vertices; exact cosine k-NN in GSQL.</p>
      </div>
    </Card>
  );
}
