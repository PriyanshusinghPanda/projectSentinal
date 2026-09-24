"use client";
import Link from "next/link";
import { animate, motion, useInView, useMotionValue, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/components/ui";
import { CaseFile } from "./CaseFile";

export interface LandingStats {
  cases: number;
  fraud: number;
  legitimate: number;
  uncertain: number;
  sars: number;
  exposure: number;
  needEvidence: number;
  patterns: [string, number][];
}

const EASE = [0.22, 1, 0.36, 1] as const;

function FadeIn({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.6, delay, ease: EASE }} className={className}>
      {children}
    </motion.div>
  );
}

function Counter({ to, prefix = "" }: { to: number; prefix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView || reduce) return;
    const c = animate(mv, to, { duration: 1.2, ease: EASE, onUpdate: setV });
    return c.stop;
  }, [inView, to, mv, reduce]);
  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {Math.round(v).toLocaleString("en-US")}
    </span>
  );
}

/** Numbered section: "01 — Method" in the margin, serif title, hairline above. */
function Section({ id, n, label, title, intro, children }: { id?: string; n: string; label: string; title: React.ReactNode; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-20 md:py-24">
        <FadeIn className="grid gap-6 md:grid-cols-[220px_1fr]">
          <div className="text-[13px] text-muted-foreground">
            <span className="tabular-nums text-foreground">{n}</span> — {label}
          </div>
          <div>
            <h2 className="max-w-3xl font-serif text-[38px] leading-[1.08] tracking-[-0.01em] md:text-[46px]">{title}</h2>
            {intro && <p className="mt-5 max-w-2xl text-[16px] leading-7 text-muted-foreground">{intro}</p>}
          </div>
        </FadeIn>
        <div className="mt-14">{children}</div>
      </div>
    </section>
  );
}

const TEAM: [string, string][] = [
  ["Transaction analyst", "Reads the card's recent window: bursts, sub-$5 test authorizations, amounts and product codes the card has never used."],
  ["Device & identity", "Checks the identity record — a device marked New for the account, proxy use, and the OS / browser / screen profile."],
  ["Graph analyst", "Looks across customers: who else used this device profile or billing region in the same month."],
  ["Case memory", "Retrieves closed investigations on the same customer, device or pattern, and cites them."],
  ["Policy", "Maps the evidence to Fraud Policy v1.0 — rules R1–R10, case versus report, and approval routes."],
  ["Challenger", "Makes the strongest innocent explanation — a trip, a recurring charge, a new phone — before anything is decided."],
  ["Orchestrator", "Sets a calibrated fraud probability, requests evidence when it is below the bar, and records why it stopped."],
];

const ROUTES: [string, string, string][] = [
  ["auto", "Agent may execute", "Verify with customer · Step-up authentication · Monitor card · Monitor connected cards · Create case · Close as no fraud"],
  ["L1", "Team lead approves", "Decline transaction · Block card when exposure ≤ $2,500"],
  ["L2", "Fraud manager approves", "Block card when exposure > $2,500 · Block all cards · File suspicious activity report"],
];

export function Landing({ stats }: { stats: LandingStats }) {
  const total = Math.max(1, stats.cases);
  const undocumented = stats.patterns.find(([p]) => p.startsWith("Undocumented"))?.[1] ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* top line */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto flex h-9 max-w-6xl items-center justify-between px-6 text-[12px] text-muted-foreground">
          <span className="truncate">TigerGraph × Hacker House Goa — HHGOA_IEEE fraud investigation challenge</span>
          <Link href="/cases" className="hidden items-center gap-1 text-foreground hover:underline sm:flex">
            View the {stats.cases} investigated cases <ArrowRight size={12} />
          </Link>
        </div>
      </div>

      {/* nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="font-serif text-[26px] leading-none tracking-[-0.01em]">
            Sentinel
          </Link>
          <div className="hidden items-center gap-8 text-[14px] text-muted-foreground md:flex">
            <a href="#method" className="hover:text-foreground">Method</a>
            <a href="#agents" className="hover:text-foreground">Agents</a>
            <a href="#controls" className="hover:text-foreground">Controls</a>
            <a href="#results" className="hover:text-foreground">Results</a>
            <Link href="/rings" className="hover:text-foreground">Rings</Link>
            <Link href="/monitoring" className="hover:text-foreground">Monitoring</Link>
            <Link href="/evaluation" className="hover:text-foreground">Evaluation</Link>
          </div>
          <Link href="/cases" className="flex h-9 items-center rounded-md bg-primary px-4 text-[14px] font-medium text-primary-foreground hover:bg-primary/90">
            Open the console
          </Link>
        </nav>
      </header>

      {/* hero */}
      <section className="mx-auto grid max-w-6xl gap-14 px-6 pb-20 pt-16 md:grid-cols-[1.1fr_1fr] md:pt-24">
        <div>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }} className="text-[13px] uppercase tracking-[0.12em] text-muted-foreground">
            Card fraud investigation
          </motion.p>
          <motion.h1 initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.05, ease: EASE }} className="mt-5 font-serif text-[52px] leading-[1.02] tracking-[-0.015em] md:text-[74px]">
            Every alert, investigated the way an analyst would.
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15, ease: EASE }} className="mt-7 max-w-xl text-[17px] leading-8 text-muted-foreground">
            Sentinel reads the transaction graph, checks prior cases, tests its own conclusions, and asks the customer when the evidence is thin. It recommends actions under the bank&apos;s fraud policy and sends anything that affects a customer to a person for approval.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.25, ease: EASE }} className="mt-9 flex flex-wrap gap-3">
            <Link href="/cases" className="group flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-[15px] font-medium text-primary-foreground hover:bg-primary/90">
              Review the cases <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link href="/case/HHG-014" className="flex h-11 items-center gap-2 rounded-md border border-foreground/20 px-5 text-[15px] hover:border-foreground/40 hover:bg-card">
              A shared-device ring <ArrowUpRight size={15} />
            </Link>
          </motion.div>
          <motion.dl initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }} className="mt-14 grid max-w-lg grid-cols-3 border-t border-border pt-6">
            {[
              ["Transactions", "590,742"],
              ["Closed cases", "5,565"],
              ["Cases decided", String(stats.cases)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[12px] text-muted-foreground">{k}</dt>
                <dd className="mt-1 text-[28px] font-medium leading-none tracking-[-0.02em] tabular-nums">{v}</dd>
              </div>
            ))}
          </motion.dl>
        </div>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.2, ease: EASE }}>
          <CaseFile />
        </motion.div>
      </section>

      <Section
        id="method"
        n="01"
        label="Method"
        title="A model score starts an investigation. It never ends one."
        intro="Most alerts in this data are legitimate, and some fraud scores near zero. The risk score is a reason to look. What decides a case is evidence from the graph, the bank's own history and, when that isn't enough, the customer."
      >
        <ol className="grid border-y border-border md:grid-cols-4">
          {[
            ["Open", "An alert arrives from the risk model, a customer report, or an analyst. A case is opened on the flagged transaction."],
            ["Investigate", "Specialists query TigerGraph through MCP: the card's window, its devices and regions, and other customers linked to them."],
            ["Challenge", "A dedicated agent argues the innocent explanation. Evidence that doesn't survive it is discounted."],
            ["Decide", "Below the bar, verify first. Above it, act, and file a report only when the policy requires one."],
          ].map(([t, d], i) => (
            <FadeIn key={t} delay={i * 0.06} className={cn("py-7 md:px-6", i > 0 && "border-t border-border md:border-l md:border-t-0", i === 0 && "md:pl-0")}>
              <div className="text-[13px] tabular-nums text-muted-foreground">Step {i + 1}</div>
              <div className="mt-2 font-serif text-[24px]">{t}</div>
              <p className="mt-2 text-[14.5px] leading-6 text-muted-foreground">{d}</p>
            </FadeIn>
          ))}
        </ol>
      </Section>

      <Section
        id="agents"
        n="02"
        label="Agents"
        title="Seven narrow roles, one of which is there to disagree."
        intro="Each agent does one job and writes down what it found and where. The orchestrator decides only after every finding has been challenged."
      >
        <dl className="grid gap-x-12 md:grid-cols-2">
          {TEAM.map(([name, role], i) => (
            <FadeIn key={name} delay={(i % 2) * 0.05} className="grid grid-cols-[150px_1fr] gap-4 border-t border-border py-5 sm:grid-cols-[170px_1fr]">
              <dt className={cn("text-[15px] font-medium", name === "Challenger" && "text-agent-challenger")}>{name}</dt>
              <dd className="text-[14.5px] leading-6 text-muted-foreground">{role}</dd>
            </FadeIn>
          ))}
        </dl>
      </Section>

      <Section
        id="controls"
        n="03"
        label="Controls"
        title="The agent recommends. People approve what affects a customer."
        intro="Every recommended action carries the approval route the policy assigns to it. Only actions on the automatic route are executed by the agent."
      >
        <FadeIn className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[640px] text-left text-[14.5px]">
            <thead>
              <tr className="border-b border-border text-[12px] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-6 py-3 font-medium">Route</th>
                <th className="px-6 py-3 font-medium">Who</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ROUTES.map(([route, who, actions]) => (
                <tr key={route} className="border-b border-border align-top last:border-0">
                  <td className="px-6 py-5 font-mono text-[13px]">{route}</td>
                  <td className="px-6 py-5 font-medium">{who}</td>
                  <td className="px-6 py-5 leading-6 text-muted-foreground">{actions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </FadeIn>
        <FadeIn className="mt-6 max-w-2xl text-[14.5px] leading-6 text-muted-foreground">
          A case and a regulatory report are different things. Sentinel opens a case whenever fraud probability reaches 0.30, evidence is requested, or a customer disputes a charge. It files a suspicious activity report only when fraud is confirmed and exposure, a shared device, or a coordinated pattern calls for one.
        </FadeIn>
      </Section>

      <Section
        id="results"
        n="04"
        label="Results"
        title={<>{stats.cases} cases. Most of the work was knowing when <em>not</em> to block.</>}
        intro="An agent that blocks every alert scores badly. These are the outcomes across the exam set, taken from the submitted case files."
      >
        <div className="grid gap-12 md:grid-cols-[1.2fr_1fr]">
          <FadeIn>
            <div className="space-y-6">
              {[
                ["Legitimate", "Closed without customer impact", stats.legitimate, "bg-risk-low"],
                ["Fraud", "Blocked or reported under policy", stats.fraud, "bg-risk-critical"],
                ["Uncertain", "Escalated to an analyst (R8)", stats.uncertain, "bg-risk-medium"],
              ].map(([k, d, n, bg], i) => (
                <div key={k as string}>
                  <div className="flex items-baseline justify-between gap-4">
                    <div>
                      <span className="text-[15px] font-medium">{k}</span>
                      <span className="ml-3 text-[13px] text-muted-foreground">{d}</span>
                    </div>
                    <span className="text-[26px] font-medium leading-none tracking-[-0.02em] tabular-nums">{n as number}</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-muted">
                    <motion.div className={cn("h-full", bg as string)} initial={{ width: 0 }} whileInView={{ width: `${((n as number) / total) * 100}%` }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.1 + i * 0.1, ease: EASE }} />
                  </div>
                </div>
              ))}
            </div>
            <dl className="mt-12 grid grid-cols-2 gap-y-8 border-t border-border pt-8 sm:grid-cols-4">
              {[
                ["Asked for evidence first", stats.needEvidence, ""],
                ["Reports filed", stats.sars, ""],
                ["Undocumented schemes", undocumented, ""],
                ["Exposure identified", stats.exposure, "$"],
              ].map(([k, n, prefix]) => (
                <div key={k as string} className="flex flex-col-reverse">
                  <dt className="mt-2 text-[12.5px] leading-5 text-muted-foreground">{k as string}</dt>
                  <dd className="text-[28px] font-medium leading-none tracking-[-0.02em]">
                    <Counter to={n as number} prefix={prefix as string} />
                  </dd>
                </div>
              ))}
            </dl>
          </FadeIn>
          <FadeIn delay={0.1}>
            <div className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Patterns identified</div>
            <ul className="mt-3">
              {stats.patterns.map(([name, n]) => (
                <li key={name} className="flex items-baseline justify-between border-b border-border py-3 text-[15px]">
                  <span>{name}</span>
                  <span className="tabular-nums text-muted-foreground">{n}</span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-[14px] leading-6 text-muted-foreground">
              Two schemes fit none of the bank&apos;s documented patterns: one device profile used across many customers&apos; cards behind an anonymous proxy, and online purchases sized just under a $500 authorization threshold.
            </p>
          </FadeIn>
        </div>
      </Section>

      <Section n="05" label="Architecture" title="Built on a graph, because fraud is a relationship problem.">
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
          {[
            ["TigerGraph", "Customers, cards, transactions, device profiles, billing regions and closed cases in one graph. Every investigation is written back as a case vertex."],
            ["MCP and GraphRAG", "Installed GSQL queries are exposed to the agent as tools. Policy, pattern definitions and closed-case notes are retrieved as context."],
            ["Policy-bound agents", "Specialists, a challenger and an orchestrator — deterministic where decisions matter, with every step recorded in the case file."],
          ].map(([t, d], i) => (
            <FadeIn key={t} delay={i * 0.06} className="bg-card p-7">
              <div className="font-serif text-[24px]">{t}</div>
              <p className="mt-3 text-[14.5px] leading-6 text-muted-foreground">{d}</p>
            </FadeIn>
          ))}
        </div>
      </Section>

      <section className="border-t border-border bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-6 py-20 md:flex-row md:items-end">
          <h2 className="max-w-2xl font-serif text-[40px] leading-[1.08] md:text-[52px]">Open any case and change the customer&apos;s answer.</h2>
          <Link href="/cases" className="group flex h-12 shrink-0 items-center gap-2 rounded-md bg-primary px-6 text-[15px] font-medium text-primary-foreground hover:bg-primary/90">
            Open the console <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-[13px] text-muted-foreground">
          <span className="font-serif text-[18px] text-foreground">Sentinel</span>
          <span>Data: IEEE-CIS Fraud Detection (Vesta), extended by TigerGraph for HHGOA. Anonymized; no real people.</span>
        </div>
      </footer>
    </div>
  );
}
