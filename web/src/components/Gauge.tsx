"use client";
import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { useEffect } from "react";
import type { Assessment } from "@/lib/types";
import { riskColor } from "./ui";

/** 180° risk arc with inner confidence arc. Animates from previous to new value when evidence arrives. */
export function Gauge({ a, prev, showConfidence = true }: { a: Assessment | null; prev?: Assessment | null; showConfidence?: boolean }) {
  const risk = a?.riskScore ?? 0;
  const conf = a?.confidence ?? 0;
  const mv = useMotionValue(prev?.riskScore ?? 0);
  const display = useTransform(mv, (v) => Math.round(v * 100).toString());
  useEffect(() => {
    const c = animate(mv, risk, { duration: 0.9, ease: [0.16, 1, 0.3, 1] });
    return c.stop;
  }, [risk, mv]);

  const arc = (r: number) => `M ${90 - r} 90 A ${r} ${r} 0 0 1 ${90 + r} 90`;
  const color = a ? riskColor(a.band) : "hsl(var(--muted-foreground))";
  const delta = a && prev ? Math.round((a.riskScore - prev.riskScore) * 100) : null;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 180 100" className="w-[200px]">
        <path d={arc(76)} fill="none" stroke="hsl(var(--muted))" strokeWidth={10} strokeLinecap="round" />
        <motion.path d={arc(76)} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" initial={{ pathLength: prev?.riskScore ?? 0 }} animate={{ pathLength: Math.max(0.001, risk) }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
        {showConfidence && <path d={arc(60)} fill="none" stroke="hsl(var(--muted))" strokeWidth={3} strokeLinecap="round" />}
        {showConfidence && <motion.path d={arc(60)} fill="none" stroke="hsl(var(--confidence))" strokeWidth={3} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: Math.max(0.001, conf) }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />}
      </svg>
      <div className="-mt-12 flex items-baseline gap-1">
        <motion.span className="font-mono text-5xl font-semibold tabular-nums tracking-[-0.04em]" style={{ color }}>
          {a ? display : "—"}
        </motion.span>
        {delta !== null && delta !== 0 && (
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded px-1 font-mono text-xs ${delta > 0 ? "bg-risk-critical/15 text-risk-critical" : "bg-risk-low/15 text-risk-low"}`}>
            Δ {delta > 0 ? "+" : ""}{delta}
          </motion.span>
        )}
      </div>
      <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
        <span>Fraud probability</span>
        {showConfidence && <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-confidence" /> Confidence <span className="font-mono tabular-nums text-foreground">{a ? Math.round(conf * 100) + "%" : "—"}</span>
        </span>}
      </div>
    </div>
  );
}
