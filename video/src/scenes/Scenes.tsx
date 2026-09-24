import React from "react";
import { AbsoluteFill, interpolate, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import { Arrow, BarChart, Caption, CodeBlock, Counter, Node, Packet, Scene, Stage, theme } from "../components";
import { useEntrance } from "../hooks/useEntrance";

const C = theme.colors;
const s = (sec: number) => Math.round(sec * 60); // seconds → frames @60fps

/* ── shared bits ─────────────────────────────────────────────────────────── */

/** Fade a whole scene in and out so cuts feel edited, not abrupt. */
export const Fade: React.FC<{ children: React.ReactNode; len: number; inF?: number; outF?: number }> = ({ children, len, inF = 14, outF = 14 }) => {
  const f = useCurrentFrame();
  const o = Math.min(interpolate(f, [0, inF], [0, 1], { extrapolateRight: "clamp" }), interpolate(f, [len - outF, len], [1, 0], { extrapolateLeft: "clamp" }));
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

const Eyebrow: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const p = useEntrance({ delay });
  return (
    <div style={{ fontFamily: theme.font.family, fontSize: 22, letterSpacing: 3.5, textTransform: "uppercase", color: C.muted, opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
      {children}
    </div>
  );
};

const Rule: React.FC<{ delay?: number; width?: number }> = ({ delay = 0, width = 520 }) => {
  const f = useCurrentFrame();
  const w = interpolate(f, [delay, delay + s(0.9)], [0, width], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: (x) => 1 - Math.pow(1 - x, 3) });
  return <div style={{ height: 1.5, width: w, background: C.fg, opacity: 0.8 }} />;
};

const Line: React.FC<{ children: React.ReactNode; delay: number; size?: number; color?: string; serif?: boolean; italic?: boolean }> = ({ children, delay, size = 44, color = C.fg, serif, italic }) => {
  const p = useEntrance({ delay, config: "smooth" });
  return (
    <div style={{ fontFamily: serif ? theme.font.display : theme.font.family, fontStyle: italic ? "italic" : "normal", fontSize: size, lineHeight: 1.2, color, opacity: p, transform: `translateY(${(1 - p) * 18}px)` }}>
      {children}
    </div>
  );
};

/* ── 1. Title ─────────────────────────────────────────────────────────────── */

export const TitleScene: React.FC = () => (
  <Scene>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 36 }}>
      <Eyebrow delay={s(0.2)}>TigerGraph × Hacker House Goa · HHGOA_IEEE</Eyebrow>
      <Line delay={s(0.5)} size={200} serif>
        Sentinel
      </Line>
      <Rule delay={s(1.1)} />
      <Line delay={s(1.5)} size={46} color={C.muted}>
        Every card-fraud alert, investigated the way an analyst would.
      </Line>
    </div>
  </Scene>
);

/* ── 2. Problem ───────────────────────────────────────────────────────────── */

export const ProblemScene: React.FC = () => {
  const facts: [string, number, string?][] = [
    ["Every transaction carries a risk score from the bank's model.", 2.6],
    ["Above 0.7, most flagged transactions turn out to be legitimate.", 5.4, C.warn],
    ["And some fraud scores close to zero.", 8.2],
    ["Half of the 20 exam cases aren't fraud at all.", 11.0],
  ];
  return (
    <Scene>
      <div style={{ display: "grid", gridTemplateColumns: "560px 1fr", gap: 110, alignItems: "center", width: 1640 }}>
        <div>
          <Eyebrow delay={s(0.2)}>The problem</Eyebrow>
          <div style={{ marginTop: 26 }}>
            <Counter to={590742} delay={s(0.4)} duration={s(1.8)} color={C.fg} size={128} align="left" />
          </div>
          <Line delay={s(0.9)} size={30} color={C.muted}>
            card transactions over six months · 13,553 customers
          </Line>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 30, borderLeft: `1.5px solid ${C.border}`, paddingLeft: 70 }}>
          {facts.map(([t, d, c]) => (
            <Line key={t} delay={s(d)} size={42} color={c ?? C.fg}>
              {t}
            </Line>
          ))}
          <div style={{ marginTop: 26 }}>
            <Line delay={s(14.2)} size={64} serif italic color={C.danger}>
              Blocking on the score alone fails.
            </Line>
          </div>
        </div>
      </div>
    </Scene>
  );
};

/* ── 3. How it works (architecture) ───────────────────────────────────────── */

export const ArchitectureScene: React.FC = () => {
  const d = (sec: number) => s(sec);
  // layout (Stage coordinates, node centers)
  const TG = { x: 250, y: 500 }, MCP = { x: 690, y: 500 };
  const SP = { x: 1140, y: 270 }, CH = { x: 1140, y: 500 }, OR = { x: 1140, y: 730 };
  const PO = { x: 1640, y: 400 };
  const W = 350, H = 160;
  const edgeR = (n: { x: number }) => n.x + W / 2, edgeL = (n: { x: number }) => n.x - W / 2;
  const phases: [number, number, string][] = [
    [0, 7.5, "The graph: customers, cards, transactions, device profiles, regions — and 5,565 closed cases"],
    [7.5, 14, "Agents query it through TigerGraph MCP: installed GSQL queries exposed as tools"],
    [14, 21, "Specialists gather evidence; a Challenger argues the innocent explanation"],
    [21, 27, "The Orchestrator sets a probability, asks for evidence when unsure, maps actions to policy"],
    [27, 33, "Every investigation is written back to the graph as case memory"],
  ];
  return (
    <Stage>
      <Node label="TigerGraph" sublabel="590k txns · devices · regions · closed cases" cx={TG.x} cy={TG.y} width={W} height={H + 30} accent={C.accent} delay={d(0.3)} />
      <Arrow x1={edgeR(TG)} y1={TG.y} x2={edgeL(MCP)} y2={MCP.y} color={C.accent} delay={d(7.6)} />
      <Node label="MCP" sublabel="GSQL queries as tools" cx={MCP.x} cy={MCP.y} width={W - 70} height={H} accent={C.accent} delay={d(7.8)} />
      {["card_window", "device_neighbors", "case_memory"].map((q, i) => (
        <Packet key={q} x1={edgeR(TG)} y1={TG.y - 30 + i * 30} x2={edgeL(MCP) + 30} y2={MCP.y - 30 + i * 30} start={d(9 + i * 1.3)} duration={d(1.1)} color={C.accent} label={q} size={16} bow={30} />
      ))}
      <Arrow x1={MCP.x + (W - 70) / 2} y1={MCP.y} x2={edgeL(SP)} y2={SP.y} color={C.fg} delay={d(14.1)} bow={-40} />
      <Node label="Specialists" sublabel="card · device · graph · memory" cx={SP.x} cy={SP.y} width={W} height={H} accent={C.fg} delay={d(14.3)} />
      <Arrow x1={SP.x} y1={SP.y + H / 2} x2={CH.x} y2={CH.y - H / 2} color={C.danger} delay={d(16.2)} />
      <Node label="Challenger" sublabel="argues the innocent story" cx={CH.x} cy={CH.y} width={W} height={H} accent={C.danger} delay={d(16.4)} />
      <Arrow x1={CH.x} y1={CH.y + H / 2} x2={OR.x} y2={OR.y - H / 2} color={C.fg} delay={d(21.1)} />
      <Node label="Orchestrator" sublabel="probability · evidence · stop" cx={OR.x} cy={OR.y} width={W} height={H} accent={C.fg} delay={d(21.3)} />
      <Arrow x1={edgeR(OR)} y1={OR.y} x2={edgeL(PO)} y2={PO.y + 40} color={C.accent} delay={d(23)} bow={60} />
      <Node label="Fraud Policy v1.0" sublabel="rules R1–R10 · case vs report" cx={PO.x} cy={PO.y} width={W + 30} height={H} accent={C.accent} delay={d(23.2)} />
      <RouteChips x={PO.x} y={PO.y + 120} delay={d(24.6)} />
      <Packet x1={edgeL(OR)} y1={OR.y + 20} x2={TG.x + 40} y2={TG.y + H / 2 + 20} start={d(27.6)} duration={d(2.2)} color={C.accent2} label="InvestigationCase → graph" size={18} bow={-160} />
      {phases.map(([a, b, t]) => (
        <Sequence key={t} from={d(a)} durationInFrames={d(b - a)}>
          <Caption bottom={70}>{t}</Caption>
        </Sequence>
      ))}
    </Stage>
  );
};

const RouteChips: React.FC<{ x: number; y: number; delay: number }> = ({ x, y, delay }) => {
  const rows: [string, string, string][] = [
    ["auto", "agent may execute", C.accent2],
    ["L1", "team lead approves", C.warn],
    ["L2", "fraud manager approves", C.danger],
  ];
  return (
    <div style={{ position: "absolute", left: x - 195, top: y, width: 390, display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map(([r, t, c], i) => (
        <Chip key={r} delay={delay + i * 10} route={r} text={t} color={c} />
      ))}
    </div>
  );
};

const Chip: React.FC<{ delay: number; route: string; text: string; color: string }> = ({ delay, route, text, color }) => {
  const p = useEntrance({ delay });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 16px", background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 10, opacity: p, transform: `translateX(${(1 - p) * 20}px)` }}>
      <span style={{ fontFamily: theme.font.mono, fontSize: 22, color, minWidth: 54, fontWeight: 600 }}>{route}</span>
      <span style={{ fontFamily: theme.font.family, fontSize: 22, color: C.fg }}>{text}</span>
    </div>
  );
};

/* ── 4. Section card between parts ────────────────────────────────────────── */

export const SectionCard: React.FC<{ n: string; title: string; sub: string }> = ({ n, title, sub }) => (
  <Scene>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
      <Eyebrow delay={s(0.15)}>{n}</Eyebrow>
      <Line delay={s(0.35)} size={96} serif>
        {title}
      </Line>
      <Line delay={s(0.7)} size={36} color={C.muted}>
        {sub}
      </Line>
    </div>
  </Scene>
);

/* ── 7. TigerGraph proof ──────────────────────────────────────────────────── */

const GSQL = `CREATE QUERY device_neighbors(VERTEX<DeviceProfile> dev,
    DATETIME around, INT days = 31) FOR GRAPH Sentinel {
  SetAccum<STRING> @@customers, @@closed_fraud_cases;
  S = {dev};
  T = SELECT t FROM S:d -(DEVICE_OF>)- Transaction:t
      WHERE t.ts >= datetime_sub(around, INTERVAL days DAY);
  C = SELECT c FROM T:t -(MADE_BY>)- CardProfile:k
      -(OWNED_BY>)- Customer:c ACCUM @@customers += c.id;
  F = SELECT cc FROM T:t -(INVOLVED_IN>)- ClosedCase:cc
      WHERE cc.outcome == "confirmed_fraud"
      ACCUM @@closed_fraud_cases += cc.id;
  PRINT @@customers, @@closed_fraud_cases;
}`;

export const TigerGraphScene: React.FC = () => {
  const stats: [number, string, number][] = [
    [590742, "transactions", 1.2],
    [2371637, "edges", 1.8],
    [9704, "device profiles", 2.4],
    [5565, "closed cases (memory)", 3.0],
  ];
  return (
    <Scene>
      <div style={{ display: "grid", gridTemplateColumns: "1040px 1fr", gap: 70, alignItems: "center", width: 1720 }}>
        <div>
          <Eyebrow delay={s(0.2)}>Built on TigerGraph Savanna · graph “Sentinel”</Eyebrow>
          <div style={{ marginTop: 24 }}>
            <CodeBlock code={GSQL} title="queries.gsql — called by the agent via tigergraph__run_installed_query" delay={s(0.6)} step={6} highlight={[5, 7, 9]} fontSize={23} />
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {stats.map(([n, l, dl]) => (
            <div key={l}>
              <Counter to={n} delay={s(dl)} duration={s(1.6)} color={C.fg} size={58} align="left" />
              <Line delay={s(dl + 0.2)} size={26} color={C.muted}>
                {l}
              </Line>
            </div>
          ))}
          <div style={{ marginTop: 10, padding: "18px 22px", background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 12, fontFamily: theme.font.mono, fontSize: 22, lineHeight: 1.6 }}>
            <Line delay={s(10)} size={22} color={C.muted}>
              cases/HHG-014.json
            </Line>
            <Line delay={s(10.6)} size={23}>
              <span style={{ color: C.accent }}>"written_to_graph"</span>: <span style={{ color: C.accent2 }}>true</span>,
            </Line>
            <Line delay={s(11.1)} size={23}>
              <span style={{ color: C.accent }}>"graph_case_id"</span>: <span style={{ color: C.warn }}>"CASE-HHG-014"</span>
            </Line>
          </div>
        </div>
      </div>
      <Sequence from={s(1)} durationInFrames={s(9)}>
        <Caption bottom={40}>The full dataset lives in TigerGraph; the agent's graph questions are installed GSQL queries</Caption>
      </Sequence>
      <Sequence from={s(10)} durationInFrames={s(16)}>
        <Caption bottom={40}>All 20 investigations are written back as InvestigationCase vertices — memory for the next alert</Caption>
      </Sequence>
    </Scene>
  );
};

/* ── 8. Results ───────────────────────────────────────────────────────────── */

export const ResultsScene: React.FC = () => {
  const kpis: [number, string, string, number][] = [
    [17, "", "asked for evidence before acting", 6],
    [16, "", "changed their recommendation after it", 7],
    [3, "", "suspicious activity reports filed", 8],
    [3521, "$", "fraud exposure identified", 9],
  ];
  return (
    <Scene>
      <div style={{ width: 1640 }}>
        <Eyebrow delay={s(0.2)}>Results · 20 exam cases</Eyebrow>
        <div style={{ marginTop: 18 }}>
          <Line delay={s(0.4)} size={68} serif>
            Most of the work was knowing when <i>not</i> to block.
          </Line>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 90, marginTop: 64, alignItems: "start" }}>
          <BarChart
            delay={s(1.6)}
            step={s(0.4)}
            width={760}
            barHeight={58}
            max={10}
            data={[
              { label: "Fraud — blocked / reported", value: 9, color: C.danger },
              { label: "Legitimate — closed, no impact", value: 8, color: C.accent2 },
              { label: "Uncertain — escalated (R8)", value: 3, color: C.warn },
            ]}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "36px 48px" }}>
            {kpis.map(([n, pre, l, dl]) => (
              <div key={l} style={{ borderTop: `1.5px solid ${C.border}`, paddingTop: 16 }}>
                <Counter to={n} prefix={pre} delay={s(dl)} duration={s(1.4)} color={C.fg} size={62} align="left" />
                <Line delay={s(dl + 0.2)} size={24} color={C.muted}>
                  {l}
                </Line>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 50 }}>
          <Line delay={s(12)} size={34} color={C.fg}>
            <span style={{ color: C.danger }}>2 undocumented schemes</span> found across 3 cases: a shared-device ring behind an anonymous proxy, and purchases sized just under a $500 threshold.
          </Line>
        </div>
      </div>
    </Scene>
  );
};

/* ── 9. Outro ─────────────────────────────────────────────────────────────── */

export const OutroScene: React.FC = () => (
  <Scene>
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 30 }}>
      <Line delay={s(0.2)} size={150} serif>
        Sentinel
      </Line>
      <Rule delay={s(0.7)} width={440} />
      <Line delay={s(1.0)} size={34} color={C.muted}>
        TigerGraph · MCP · GraphRAG · policy-bound agents
      </Line>
      <div style={{ marginTop: 26, fontFamily: theme.font.mono }}>
        <Line delay={s(1.6)} size={32}>
          github.com/PriyanshusinghPanda/projectSentinal
        </Line>
      </div>
      <Line delay={s(2.2)} size={30} color={C.accent}>
        #TigerGraph · @TigerGraphDB
      </Line>
    </div>
  </Scene>
);

export { s };
export const useFps = () => useVideoConfig().fps;
