"use client";
import { useEffect, useState } from "react";
import type { PastCase } from "@/lib/types";
import { FRAUD_PATTERNS } from "@/lib/data";
import { Shell } from "@/components/Shell";
import { Card, Label, cn } from "@/components/ui";
import { SemanticSearch } from "@/components/SemanticSearch";

const DATASET_PATTERNS: Record<string, [string, string]> = {
  card_testing: ["Card testing", "3+ tiny online authorizations, then a larger purchase (R5)"],
  card_not_present_fraud: ["Card-not-present fraud", "Online amounts / products that don't fit history, often a burst"],
  card_not_present_new_device: ["CNP · new device", "Same, with the identity record marking the device New"],
  out_of_region_use: ["Out-of-region use", "Card-present in a region with no history while home activity continues"],
  account_takeover: ["Account takeover", "Mixed channel with device and match-flag anomalies"],
};

export default function Memory() {
  const [memory, setMemory] = useState<PastCase[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | PastCase["outcome"]>("all");
  const [source, setSource] = useState("");
  useEffect(() => { fetch("/api/cases").then((r) => r.json()).then((d) => { setMemory(d.memory); setSource(d.source); }); }, []);
  const shown = memory.filter((m) => (filter === "all" || m.outcome === filter) && (m.summary + m.id + m.analystDecision).toLowerCase().includes(q.toLowerCase()));
  return (
    <Shell source={source} crumbs={<span>Case memory</span>}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[34px] leading-tight">Case memory</h1>
          <p className="text-xs text-muted-foreground">Closed investigations, decisions and outcomes ({memory.length} most recent shown). Retrieved as precedent for every new case.</p>
        </div>
        <div className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search memory…" className="h-8 w-56 rounded-md border border-border bg-card px-2.5 text-[13px] outline-none focus:border-accent/60" />
          {(["all", "confirmed_fraud", "cleared"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn("h-8 rounded-md border border-border px-3 text-xs capitalize text-muted-foreground hover:bg-elevated", filter === f && "bg-elevated text-foreground")}>{f.replace("_", " ")}</button>
          ))}
        </div>
      </div>
      <SemanticSearch />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {(memory.some((m) => m.pattern in DATASET_PATTERNS) ? Object.entries(DATASET_PATTERNS).map(([id, [name, description]]) => ({ id, name, description })) : FRAUD_PATTERNS).map((p) => {
          const cases = memory.filter((m) => m.pattern === p.id);
          return (
            <Card key={p.id} className="p-3">
              <div className="flex justify-between"><span className="text-[11px] text-muted-foreground">{p.id.replace(/_/g, " ")}</span><span className="font-mono text-[11px]">{cases.length}</span></div>
              <div className="mt-1 text-[13px] font-medium">{p.name}</div>
              <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{p.description}</div>
            </Card>
          );
        })}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((m) => (
          <Card key={m.id} className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-xs">{m.id}</span>
              <span className={cn("rounded-md border px-2 py-0.5 text-[11px]", m.outcome === "confirmed_fraud" ? "border-risk-critical/30 bg-risk-critical/10 text-risk-critical" : "border-risk-low/30 bg-risk-low/10 text-risk-low")}>{m.outcome.replace("_", " ")}</span>
            </div>
            <div className="text-[13px]">{m.summary}</div>
            <Label className="mb-1 mt-3">Analyst decision</Label>
            <div className="text-xs text-muted-foreground">{m.analystDecision}</div>
            <div className="mt-3 flex flex-wrap gap-1">
              {Object.entries(m.features).filter(([, v]) => v !== undefined && String(v) !== "").slice(0, 4).map(([k, v]) => (
                <span key={k} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground/80">{k}={String(v)}</span>
              ))}
            </div>
            <div className="mt-3 font-mono text-[10px] text-subtle">closed {m.closedAt} · pattern {m.pattern}</div>
          </Card>
        ))}
      </div>
    </Shell>
  );
}
