import Link from "next/link";
import { Shell } from "@/components/Shell";
import { Card, PanelHeader } from "@/components/ui";
import { insight } from "@/lib/insights";

export const dynamic = "force-dynamic";

/** Fraud Policy v1.0 as given in the HHGOA_IEEE README, with the exam cases where each rule fired. */
const RULES: [string, string, string][] = [
  ["R1", "Verify before you block on a weak signal", "If the case rests on a single signal (including a risk score alone) and fraud probability is below 0.70, recommend VERIFY_WITH_CUSTOMER or STEP_UP_AUTH before any block."],
  ["R2", "Customer denies the transaction", "BLOCK_CARD and CREATE_CASE; add FILE_REPORT if exposure exceeds $1,000 or the case connects to a shared device profile or another card's fraud."],
  ["R3", "Customer confirms the transaction", "CLOSE_NO_FRAUD, noting the confirmation in the case file."],
  ["R4", "No reply within 24 hours", "MONITOR_CARD and DECLINE_TRANSACTION for pending authorizations; escalate if exposure exceeds $500."],
  ["R5", "Card testing", "Three or more small online authorizations within an hour, then a larger purchase: DECLINE_TRANSACTION and STEP_UP_AUTH; BLOCK_CARD if a purchase over $100 has already cleared."],
  ["R6", "Shared origin", "Several cards with fraud from the same device profile, region, or recipient email: name it, CREATE_CASE and FILE_REPORT, MONITOR_CONNECTED_CARDS for every card that shares it."],
  ["R7", "Disputed but legitimate", "A disputed charge matching the customer's own recurring pattern: CREATE_CASE, VERIFY_WITH_CUSTOMER and WARN_CUSTOMER. Do not block."],
  ["R8", "Escalate when uncertain and exposed", "Verdict uncertain with exposure over $500, or conflicting evidence: ESCALATE_TO_ANALYST."],
  ["R9", "Undocumented patterns", "Coordinated or repeated abuse fitting no known pattern: CREATE_CASE, FILE_REPORT and ESCALATE_TO_ANALYST, described in plain words."],
  ["R10", "Never block all cards", "BLOCK_ALL_CARDS only if at least two of the customer's cards show confirmed fraud or credentials are confirmed compromised."],
  ["3a", "A case is not a report", "Open a case at probability ≥ 0.30, whenever evidence is requested, or on a dispute. File a report only for confirmed / strongly suspected fraud with exposure over $1,000, a shared device or region cluster, another customer's fraud, or a coordinated / undocumented pattern."],
];
const ROUTES: [string, string][] = [
  ["auto", "ALLOW_TRANSACTION, MONITOR_CARD, MONITOR_CONNECTED_CARDS, WARN_CUSTOMER, VERIFY_WITH_CUSTOMER, STEP_UP_AUTH, GENERATE_REPORT, CREATE_CASE, ESCALATE_TO_ANALYST, CLOSE_NO_FRAUD"],
  ["L1 · team lead", "DECLINE_TRANSACTION; BLOCK_CARD when exposure ≤ $2,500"],
  ["L2 · fraud manager", "BLOCK_CARD when exposure > $2,500; BLOCK_ALL_CARDS; FILE_REPORT"],
];

export default function Policy() {
  const used = insight<Record<string, Record<string, string[]>>>("rules", {});
  return (
    <Shell source="Fraud Policy v1.0" crumbs={<span>Policy</span>}>
      <div className="mb-6 border-b border-border pb-5">
        <h1 className="font-serif text-[34px] leading-tight">Fraud Policy v1.0</h1>
        <p className="mt-1 max-w-3xl text-[13px] text-muted-foreground">The rules the agent operates under, from the HHGOA_IEEE brief. Every recommended action cites one of them; the cases beside each rule are where the agent applied it in the 20 exam cases.</p>
      </div>
      <Card className="mb-4">
        <PanelHeader title="Approval routes (§2)" />
        {ROUTES.map(([r, a]) => (
          <div key={r} className="grid grid-cols-[180px_1fr] gap-4 border-b border-border/60 px-4 py-3 text-[13px] last:border-0">
            <span className="font-mono">{r}</span>
            <span className="text-muted-foreground">{a}</span>
          </div>
        ))}
      </Card>
      <Card>
        <PanelHeader title="Rules (§3)" />
        {RULES.map(([id, title, text]) => {
          const cases = Object.entries(used[id] ?? {});
          return (
            <div key={id} className="grid grid-cols-1 gap-3 border-b border-border/60 px-4 py-4 last:border-0 lg:grid-cols-[70px_1fr_380px]">
              <span className="font-mono text-[13px] font-semibold text-accent">{id}</span>
              <div>
                <div className="text-[14px] font-medium">{title}</div>
                <p className="mt-1 text-[13px] leading-6 text-muted-foreground">{text}</p>
              </div>
              <div className="flex flex-wrap content-start gap-1.5">
                {cases.length === 0 && <span className="text-[12px] text-subtle">Not triggered in the exam set</span>}
                {cases.map(([c, acts]) => (
                  <Link key={c} href={`/case/${c}`} title={acts.join("\n")} className="rounded-md border border-border bg-card px-2 py-1 font-mono text-[11.5px] hover:border-foreground/30">
                    {c}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </Card>
    </Shell>
  );
}
