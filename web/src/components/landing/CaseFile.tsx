"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/components/ui";

/**
 * Hero artifact: the case file for exam case HHG-005, as an analyst would see it
 * (facts from cases/HHG-005.json and its "customer denies" variant). The decision section
 * steps once from the initial recommendation to the final one.
 */
const EVIDENCE = [
  ["Card history", "Amount and product code fit C02923-K1's history; no burst or test authorizations."],
  ["Identity record", "Device marked New for the account — iOS 9.3.5, Mobile Safari."],
  ["Case memory", "CC-2400, CC-2717 and CC-2857 on the same device profile — all confirmed fraud."],
  ["Challenger", "A single new device is weak evidence on its own; people replace phones."],
];

export function CaseFile() {
  const reduce = useReducedMotion();
  const [stage, setStage] = useState<0 | 1>(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    const t = setInterval(() => setStage((s) => (s === 0 ? 1 : 0)), 4200);
    return () => clearInterval(t);
  }, [reduce]);

  const initial = { p: "0.35", label: "Before evidence", actions: [["Verify with customer", "auto"], ["Create case", "auto"]], rule: "R1 — single signal below 0.70: verify before any block." };
  const final = { p: "0.88", label: "After the customer denies", actions: [["Block card", "L1"], ["Create case", "auto"]], rule: "R2 — customer denies; exposure $100.07 ≤ $2,500, team-lead approval." };
  const d = stage === 0 ? initial : final;

  return (
    <div className="relative">
      <div className="absolute -right-3 -top-3 hidden h-full w-full rounded-lg border border-border bg-card/60 md:block" aria-hidden />
      <article className="relative rounded-lg border border-border bg-card shadow-[0_1px_0_hsl(var(--border)),0_24px_48px_-24px_hsl(30_20%_30%/0.25)]">
        <header className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <div className="text-[12px] uppercase tracking-[0.1em] text-muted-foreground">Case file</div>
            <div className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.02em]">HHG-005</div>
          </div>
          <div className="text-right text-[12.5px] leading-5 text-muted-foreground">
            <div>Opened 2016-12-08 03:38</div>
            <div>Model score 0.54 · online</div>
          </div>
        </header>

        <div className="px-6 py-5">
          <div className="text-[12px] uppercase tracking-[0.1em] text-muted-foreground">Trigger</div>
          <p className="mt-1.5 text-[14.5px] leading-6">Transaction 3523199, $100.07 on card C02923-K1.</p>
        </div>

        <div className="border-t border-border px-6 py-5">
          <div className="text-[12px] uppercase tracking-[0.1em] text-muted-foreground">Evidence</div>
          <ul className="mt-2">
            {EVIDENCE.map(([k, v], i) => (
              <motion.li key={k} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.15, duration: 0.5 }} className="grid grid-cols-[112px_1fr] gap-3 py-1.5 text-[13.5px] leading-5">
                <span className={cn("text-muted-foreground", k === "Challenger" && "text-agent-challenger")}>{k}</span>
                <span>{v}</span>
              </motion.li>
            ))}
          </ul>
        </div>

        <div className="border-t border-border bg-muted/40 px-6 py-5">
          <div className="flex items-baseline justify-between">
            <motion.div key={d.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className="text-[12px] uppercase tracking-[0.1em] text-muted-foreground">
              Recommendation · {d.label}
            </motion.div>
            <div className="text-[12.5px] text-muted-foreground">
              Fraud probability{" "}
              <motion.span key={d.p} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className={cn("inline-block text-[20px] font-semibold tabular-nums tracking-[-0.02em]", stage ? "text-risk-critical" : "text-foreground")}>
                {d.p}
              </motion.span>
            </div>
          </div>
          <motion.ul key={stage} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mt-3 space-y-2">
            {d.actions.map(([a, r]) => (
              <li key={a} className="flex items-center justify-between rounded-md border border-border bg-card px-3.5 py-2.5 text-[14px]">
                <span className="font-medium">{a}</span>
                <span className={cn("font-mono text-[12px]", r === "auto" ? "text-route-auto" : "text-route-analyst")}>{r === "auto" ? "auto" : "L1 · team lead"}</span>
              </li>
            ))}
          </motion.ul>
          <motion.p key={d.rule} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, delay: 0.1 }} className="mt-3 text-[13px] leading-5 text-muted-foreground">
            {d.rule}
          </motion.p>
          <div className="mt-4 flex gap-1.5" aria-hidden>
            {[0, 1].map((s) => (
              <span key={s} className={cn("h-0.5 w-8 transition-colors", stage === s ? "bg-foreground" : "bg-border")} />
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
