# Sentinel — Design Direction

## 1. Visual direction
- **Mood: a calm, instrument-grade control room.** Near-black blue-grey canvas, hairline borders, dense tabular data, and color only where it carries meaning (risk, agent identity, approval route). It should feel like Linear crossed with a Bloomberg terminal, not a crypto dashboard.
- **References:** Linear (hierarchy, sidebar, kbd hints), Vercel dashboard (white primary buttons, mono metadata, 1px borders), Mobbin security consoles like Wiz and Datadog Security (entity chips, severity badges), and Aceternity/Magic UI, used only for one subtle grid background, one border-beam on the live agent and a soft glow on the risk gauge.
- **Hierarchy rule:** every screen has one hero element with color. On the case view that is the risk gauge plus the live timeline. Everything else stays neutral (`muted`, `border`). Use numbers in mono, labels in sans, and write actions as verbs.
- **Density:** 13px base UI text, 8px spacing rhythm (4px inside components), 12px card radius, 1px borders at about 8% white. No shadows on dark backgrounds; show elevation with a lighter surface plus a border.
- **Avoid:** heavy gradients, glassmorphism everywhere, neon on neon, emoji, stock 3D illustrations, rainbow charts, sparkles, animated backgrounds behind data, and more than one glow per viewport. Never rely on color alone: risk and route badges always include a text label or icon.

## 2. Color tokens (`app/globals.css`, dark-first; `.dark` applies the same values)
```css
:root {
  --background: 225 20% 5%;        /* #0b0d11 canvas */
  --foreground: 220 20% 94%;       /* #eceef2  ~17:1 on bg */
  --card: 225 16% 8%;              /* #111318 surface */
  --card-foreground: 220 20% 94%;
  --popover: 225 16% 9%;
  --popover-foreground: 220 20% 94%;
  --elevated: 225 14% 11%;         /* hover rows, nested panels */
  --border: 225 12% 16%;           /* #25282f hairline */
  --input: 225 12% 18%;
  --muted: 225 12% 12%;            /* chips, table header bg */
  --muted-foreground: 220 10% 62%; /* #9699a3  ~7:1 on bg */
  --subtle-foreground: 220 8% 44%; /* timestamps only  ~3.6:1 (non-essential text) */
  --primary: 0 0% 98%;             /* Vercel-style white CTA */
  --primary-foreground: 225 20% 6%;
  --secondary: 225 12% 14%;
  --secondary-foreground: 220 20% 94%;
  --accent: 234 89% 72%;           /* indigo focus / links / selection */
  --accent-foreground: 225 20% 6%;
  --ring: 234 89% 72%;
  --destructive: 0 84% 62%;
  --destructive-foreground: 0 0% 100%;
  --radius: 0.75rem;

  /* Risk scale: all >= 4.5:1 on --background and --card */
  --risk-critical: 0 84% 63%;      /* #ef5050  5.6:1 */
  --risk-high: 24 95% 60%;         /* #f98a3a  7.7:1 */
  --risk-medium: 45 95% 58%;       /* #f9c63b 11:1 */
  --risk-low: 152 60% 50%;         /* #33cc85  9:1 */
  --confidence: 172 70% 52%;       /* #28d6bd  10:1 gauge arc and confidence bars */

  /* Approval routes */
  --route-auto: 152 60% 50%;
  --route-analyst: 234 89% 72%;
  --route-senior: 45 95% 58%;

  /* Agents: hues kept away from the risk scale (0–60°, 150°) wherever possible */
  --agent-graph: 262 83% 74%;       /* violet   #a98bf6 */
  --agent-txn: 196 90% 62%;         /* sky      #40c4f5 */
  --agent-device: 300 70% 70%;      /* fuchsia  #e27ae2 */
  --agent-memory: 218 90% 68%;      /* blue     #5f93f8 */
  --agent-policy: 84 65% 55%;       /* lime     #a3d44a */
  --agent-challenger: 340 85% 66%;  /* rose     #f35d8f adversarial */
  --agent-orchestrator: 220 15% 88%;/* silver   #dcdfe5 the neutral decider */
}
```
Tailwind: in `theme.extend.colors`, map each token as `risk: { critical: 'hsl(var(--risk-critical))', ... }`, `agent: { graph: 'hsl(var(--agent-graph))', ... }`, `route: {...}`, `confidence`, `elevated`, `subtle`. For tints use the alpha form `bg-[hsl(var(--risk-critical)/0.12)]`, or set up `<alpha-value>` in the mapping so `bg-risk-critical/10` works.

## 3. Typography
- **UI:** `Geist` from `next/font/google`, exposed as `--font-sans`. **Mono:** `Geist Mono` as `--font-mono`. Use it for account IDs, card PANs (masked), IPs, amounts, timestamps and scores. Always add `tabular-nums` to numbers.
- **Fallback:** Inter Tight + JetBrains Mono.

| Role | Size / line | Weight | Tracking | Class |
|---|---|---|---|---|
| Display (risk score number) | 48/48 | 600 | -0.04em | `text-5xl font-semibold tracking-[-0.04em] font-mono tabular-nums` |
| H1 (page / case title) | 22/28 | 600 | -0.02em | `text-[22px] leading-7 font-semibold tracking-[-0.02em]` |
| H2 (panel title) | 15/20 | 600 | -0.01em | `text-[15px] leading-5 font-semibold tracking-[-0.01em]` |
| H3 (section label) | 11/16 | 500 | +0.08em uppercase | `text-[11px] leading-4 font-medium uppercase tracking-[0.08em] text-muted-foreground` |
| Body | 13/20 | 400 | 0 | `text-[13px] leading-5` |
| Body-strong | 13/20 | 500 | 0 | `text-[13px] leading-5 font-medium` |
| Small / meta | 12/16 | 400 | 0 | `text-xs text-muted-foreground` |
| Mono | 12/16 | 450 | 0 | `font-mono text-xs tabular-nums` |
| KPI number | 28/32 | 600 | -0.03em | `text-[28px] leading-8 font-semibold tracking-[-0.03em] font-mono tabular-nums` |

## 4. Layout
**App shell:** a 56px left icon rail (Queue, Cases, Memory, Settings) with a 48px top bar (breadcrumb, case ID in mono, ⌘K search, analyst avatar). Content sits in `max-w-[1600px] mx-auto px-6 py-5`, with `gap-4` between panels.

**Case investigation (hero), at 1440px or wider:** `grid grid-cols-12 gap-4`
```
┌ Case header (col-span-12, 72px): title · amount · customer · risk badge · status · [Approve] [Escalate] ┐
├ LEFT col-span-3 (~340px)      ├ CENTER col-span-6 (~680px)             ├ RIGHT col-span-3 (~340px)   ┤
│ Trigger card (alert rule, txn)│ Entity graph (h-[420px], full width)   │ Risk gauge + confidence     │
│ Risk drivers (top 5 bars)     │ Tabs: Timeline | Evidence | SAR | Log  │ Next-best-action cards      │
│ Evidence list (scroll)        │  → Agent timeline (live stream,        │   (before → after evidence) │
│ [Request more evidence]       │     flex-1, scroll, sticky composer)   │ Approval route + CTA        │
│                               │                                        │ Similar cases (3 mini)      │
└───────────────────────────────┴────────────────────────────────────────┴─────────────────────────────┘
```
- Below 1280px the layout becomes `grid-cols-8`: left panel moves into a tab, center spans 5 columns, right spans 3.
- Everything under the header fills `h-[calc(100vh-48px-72px-40px)]` and each column scrolls independently (`overflow-y-auto`).
- The "Request more evidence" step shows as an inline timeline item with a pending shimmer. When the results land, action cards animate from a "Before" to an "After" state, with a small `Δ risk +12` delta chip.
- SAR draft opens as a right-side `Sheet` (w-[560px]) with a mono-numbered narrative and an editable textarea.

**Dashboard:** a KPI strip in `grid-cols-4` (Open cases, Critical, Avg time-to-decision, Auto-resolved %). Each KPI card is 96px tall with a sparkline. Below it, `grid-cols-12`: the **case queue table** (col-span-8) with dense 40px rows showing Case ID (mono), customer, amount (mono, right-aligned), risk badge, agents-run avatar stack, route badge, age and status. The right column (col-span-4) holds "Risk distribution" as a stacked bar and "Live agent activity" as a mini feed. Table rows use `hover:bg-elevated` with a keyboard `j/k` focus ring.

**Case memory:** a search bar plus filters, then a `grid-cols-3` card grid of past cases. Each card shows a similarity % (mono, confidence color), outcome badge, shared entities as chips and a one-line pattern summary. Selecting a card opens a split view with a side-by-side mini graph.

## 5. Component recipes (Tailwind)
```ts
// Surfaces
card        = "rounded-xl border border-border bg-card"
cardPad     = "p-4"
panelHeader = "flex h-11 items-center justify-between border-b border-border px-4 text-[15px] font-semibold tracking-[-0.01em]"
sectionLbl  = "text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground"
row         = "flex items-center gap-3 px-4 h-10 border-b border-border/60 hover:bg-elevated transition-colors"

// Badges (base + variant)
badge       = "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-4"
risk.critical = "border-risk-critical/30 bg-risk-critical/10 text-risk-critical"
risk.high     = "border-risk-high/30 bg-risk-high/10 text-risk-high"
risk.medium   = "border-risk-medium/30 bg-risk-medium/10 text-risk-medium"
risk.low      = "border-risk-low/30 bg-risk-low/10 text-risk-low"
//   prefix: a dot "size-1.5 rounded-full bg-current". Critical also gets "animate-pulse" on the dot only
route.auto    = "border-route-auto/30 bg-route-auto/10 text-route-auto"          // icon: Zap  "Auto"
route.analyst = "border-route-analyst/30 bg-route-analyst/10 text-route-analyst" // icon: User "Analyst"
route.senior  = "border-route-senior/30 bg-route-senior/10 text-route-senior"    // icon: ShieldCheck "Senior approval"
entityChip    = "inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground/90"

// Agent message bubble (set --agent per agent: style={{'--agent': 'var(--agent-graph)'}})
agentMsg    = "relative rounded-lg border border-border bg-card pl-4 pr-3 py-2.5 text-[13px] leading-5 before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[2px] before:rounded-full before:bg-[hsl(var(--agent))]"
agentAvatar = "grid size-6 place-items-center rounded-md bg-[hsl(var(--agent)/0.14)] text-[hsl(var(--agent))] ring-1 ring-inset ring-[hsl(var(--agent)/0.3)]"
agentName   = "text-xs font-medium text-[hsl(var(--agent))]"
toolCall    = "mt-2 rounded-md bg-muted/60 px-2 py-1.5 font-mono text-[11px] text-muted-foreground"  // e.g. GSQL: shared_device_2hop(acct_8812)

// Challenger dispute callout
dispute     = "rounded-lg border border-agent-challenger/35 bg-[hsl(var(--agent-challenger)/0.06)] p-3 text-[13px] [background-image:repeating-linear-gradient(135deg,transparent_0_8px,hsl(var(--agent-challenger)/0.04)_8px_9px)]"
disputeHead = "mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-agent-challenger"  // icon: Swords/GitPullRequestClosed "Disputes Graph Analyst"
disputeQuote= "border-l border-border pl-2 text-muted-foreground line-through decoration-agent-challenger/50"  // the claim being disputed
resolution  = "mt-2 flex items-center gap-2 text-xs text-agent-orchestrator"  // "Orchestrator: upheld / overruled"

// Action card (next-best-action)
actionCard  = "group rounded-xl border border-border bg-card p-3.5 transition-colors hover:border-foreground/20 data-[recommended=true]:border-accent/50 data-[recommended=true]:bg-[hsl(var(--accent)/0.05)]"
actionTitle = "text-[13px] font-medium"
actionMeta  = "mt-1 flex items-center gap-2 text-xs text-muted-foreground"  // route badge · confidence % mono
actionState = "text-[10px] font-medium uppercase tracking-[0.08em] text-subtle-foreground" // "BEFORE EVIDENCE" / "AFTER EVIDENCE"
btnPrimary  = "h-8 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:bg-primary/90"
btnGhost    = "h-8 rounded-md border border-border px-3 text-[13px] hover:bg-elevated"

// Gauge (SVG 180° arc, 160px wide)
gaugeTrack  = "stroke-muted"              // strokeWidth 10, strokeLinecap round
gaugeFill   = "stroke-risk-critical"      // stroke color follows the risk band; the dasharray animates
gaugeConf   = "stroke-confidence"         // inner thin arc (strokeWidth 3), inset 14px
gaugeValue  = "font-mono text-5xl font-semibold tabular-nums tracking-[-0.04em]"
gaugeLabel  = "text-xs text-muted-foreground"   // "Risk 87 · Confidence 0.82"

// Timeline item
tlItem      = "relative pl-8 pb-4 last:pb-0"
tlLine      = "absolute left-[11px] top-7 bottom-0 w-px bg-border"
tlNode      = "absolute left-0 top-0.5"  // holds agentAvatar
tlMeta      = "mb-1 flex items-center gap-2 text-xs text-muted-foreground"  // name · mono timestamp · duration
tlLive      = "after:absolute after:-inset-px after:rounded-lg after:border after:border-[hsl(var(--agent)/0.5)] after:animate-pulse" // currently running agent

kbd         = "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[10px] text-muted-foreground shadow-[inset_0_-1px_0_hsl(var(--border))]"

// Backgrounds
gridBg      = "bg-background [background-image:linear-gradient(hsl(var(--border)/0.35)_1px,transparent_1px),linear-gradient(90deg,hsl(var(--border)/0.35)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)]"
//   used only behind the graph canvas and the dashboard hero strip
noise       = "pointer-events-none fixed inset-0 z-50 opacity-[0.025] mix-blend-overlay bg-[url('/noise.png')]"  // optional 128px PNG
glow        = "shadow-[0_0_0_1px_hsl(var(--risk-critical)/0.35),0_0_40px_-8px_hsl(var(--risk-critical)/0.45)]" // gauge card only when critical
focus       = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
```
**Graph nodes** (React Flow or a custom SVG layout): nodes are 28px circles, `bg-card border` with the ring colored by entity type. Account = foreground, Card = agent-txn, Device = agent-device, Email = agent-memory, IP = agent-policy. The flagged account gets a `risk-critical` ring plus glow. Edges are 1px `border` color; suspicious paths are 1.5px `risk-high` with an animated dash. Labels use mono 10px below the node.

## 6. Motion (Framer Motion)
- **Tokens:** `fast 120ms` (hover, press), `base 200ms` (panels, badges), `slow 400ms` (layout shifts), `gauge 900ms`. Default easing is `[0.16, 1, 0.3, 1]` (out-expo). Use springs only for the graph: `{type:'spring', stiffness:260, damping:30}`.
- **Agent messages:** each item enters with `initial={{opacity:0, y:6}} animate={{opacity:1, y:0}}` over 200ms, staggered 60ms. Text streams token by token (typewriter at about 30 chars per 16ms tick) with a 2px blinking caret `bg-[hsl(var(--agent))]`. The running agent gets `tlLive`. Auto-scroll pauses when the user scrolls up and shows a "↓ New activity" pill.
- **Challenger dispute:** enters with opacity plus `x: -4 → 0` and a one-time 600ms border flash from 60% to 35% alpha. No shaking.
- **Graph:** nodes scale from 0.6 to 1 with opacity, 30ms stagger, in BFS order from the flagged account. Newly discovered entities (after "Request more evidence") get a single expanding 1s ring pulse. Suspicious edges use a `stroke-dashoffset` loop (2s linear).
- **Gauge:** arc `pathLength` goes 0 → value over 900ms (out-expo). The number counts up with `useSpring`. When risk changes after new evidence, animate from the old value to the new one and show a `Δ +12` chip that fades in.
- **Action cards before/after:** use `AnimatePresence mode="popLayout"` plus the `layout` prop (400ms). The recommended card gets an accent border fade.
- **Never animate:** table rows, KPI numbers after first load, or anything looping except the live indicator and the suspicious-edge dash.
- **Reduced motion:** wrap the app in `<MotionConfig reducedMotion="user">`. Also, under `@media (prefers-reduced-motion: reduce)`, disable `animate-pulse`, dash loops and the typewriter (render full text), and set gauge and count-up to their final values instantly. Keep opacity fades ≤120ms.


## Revision — category palette (2026-09-24)
Benchmarked against fraud / fintech-security sites (Sardine, SEON, Unit21): trust navy + cobalt, red reserved for fraud signal, green/teal for safe, editorial serif accent with mono eyebrows, announcement bar, "built on" strip, product shown in the hero.
Tokens changed: background `222 47% 5%` (navy-black), card `222 42% 8%`, border `219 30% 17%`, accent/ring `214 100% 62%` (cobalt), risk-low/route-auto `158 64% 46%`. Display accent font: Instrument Serif italic. Landing CTAs: cobalt pill.
