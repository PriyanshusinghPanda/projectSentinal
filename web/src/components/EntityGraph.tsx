"use client";
import { motion } from "framer-motion";
import type { GraphEdge, GraphNode, NodeKind } from "@/lib/types";

const KIND_COLOR: Record<NodeKind, string> = {
  card: "var(--agent-txn)",
  account: "var(--foreground)",
  device: "var(--agent-device)",
  email: "var(--agent-memory)",
  ip: "var(--agent-policy)",
  address: "var(--agent-graph)",
  merchant: "var(--muted-foreground)",
};

/** BFS rings from the subject node → simple radial layout, no layout lib needed. */
function layout(nodes: GraphNode[], edges: GraphEdge[], w: number, h: number) {
  const subject = nodes.find((n) => n.subject) ?? nodes[0];
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
    adj.set(e.to, [...(adj.get(e.to) ?? []), e.from]);
  }
  const depth = new Map([[subject.id, 0]]);
  const order = [subject.id];
  for (let i = 0; i < order.length; i++)
    for (const n of adj.get(order[i]) ?? [])
      if (!depth.has(n)) {
        depth.set(n, depth.get(order[i])! + 1);
        order.push(n);
      }
  for (const n of nodes)
    if (!depth.has(n.id)) {
      depth.set(n.id, 3);
      order.push(n.id);
    }
  const rings = new Map<number, string[]>();
  for (const id of order) rings.set(depth.get(id)!, [...(rings.get(depth.get(id)!) ?? []), id]);
  const pos = new Map<string, { x: number; y: number; d: number; i: number }>();
  const cx = w / 2, cy = h / 2 - 8;
  const maxD = Math.max(1, ...Array.from(rings.keys()));
  Array.from(rings.entries()).forEach(([d, ids]) => {
    ids.forEach((id, i) => {
      if (d === 0) return pos.set(id, { x: cx, y: cy, d, i: 0 });
      const f = maxD === 1 ? 1 : 0.6 + (0.4 * (d - 1)) / (maxD - 1);
      const rx = f * (w / 2 - 90);
      const ry = f * (h / 2 - 40);
      const a = (i / ids.length) * Math.PI * 2 - Math.PI / 2 + d * 0.5;
      pos.set(id, { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry, d, i: order.indexOf(id) });
    });
  });
  return pos;
}

export function EntityGraph({ nodes, edges, height = 360 }: { nodes: GraphNode[]; edges: GraphEdge[]; height?: number }) {
  const w = 720, h = height;
  const pos = layout(nodes, edges, w, h);
  const flagged = new Set(nodes.filter((n) => n.flagged).map((n) => n.id));
  return (
    <div className="relative overflow-hidden">
      <div className="grid-bg pointer-events-none absolute inset-0" />
      <svg viewBox={`0 0 ${w} ${h}`} className="relative w-full" style={{ height }}>
        {edges.map((e, i) => {
          const a = pos.get(e.from)!, b = pos.get(e.to)!;
          const sus = flagged.has(e.from) || flagged.has(e.to);
          return (
            <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 + Math.max(a.i, b.i) * 0.03, duration: 0.3 }}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={sus ? "hsl(var(--risk-high))" : "hsl(var(--border))"}
                strokeWidth={sus ? 1.5 : 1}
                className={sus ? "edge-sus" : undefined}
              />
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 - 4} textAnchor="middle" className="fill-subtle font-mono" fontSize={9}>
                {e.label}
              </text>
            </motion.g>
          );
        })}
        {nodes.map((n) => {
          const p = pos.get(n.id)!;
          const color = n.flagged ? "var(--risk-critical)" : KIND_COLOR[n.kind];
          const r = n.subject ? 16 : 12;
          return (
            <motion.g
              key={n.id}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 30, delay: p.i * 0.03 }}
              style={{ transformOrigin: `${p.x}px ${p.y}px` }}
            >
              {(n.flagged || n.subject) && (
                <circle cx={p.x} cy={p.y} r={r + 7} fill={`hsl(${color} / 0.12)`} stroke={`hsl(${color} / 0.25)`} />
              )}
              <circle cx={p.x} cy={p.y} r={r} fill="hsl(var(--card))" stroke={`hsl(${color})`} strokeWidth={n.subject ? 2 : 1.5} />
              <text x={p.x} y={p.y + 3} textAnchor="middle" fontSize={8} fontWeight={600} style={{ fill: `hsl(${color})` }} className="font-mono uppercase">
                {n.kind.slice(0, 3)}
              </text>
              <text x={p.x} y={p.y + r + 13} textAnchor="middle" fontSize={10} className="fill-foreground/80 font-mono">
                {n.label}
              </text>
            </motion.g>
          );
        })}
      </svg>
      <div className="absolute bottom-2 left-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
        {(Object.keys(KIND_COLOR) as NodeKind[]).map((k) => (
          <span key={k} className="flex items-center gap-1">
            <span className="size-2 rounded-full border" style={{ borderColor: `hsl(${KIND_COLOR[k]})` }} />
            {k}
          </span>
        ))}
        <span className="flex items-center gap-1 text-risk-critical">
          <span className="size-2 rounded-full border border-risk-critical" /> linked to confirmed fraud
        </span>
      </div>
    </div>
  );
}
