import { Shell } from "@/components/Shell";
import { Card, Label, PanelHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { insight } from "@/lib/insights";

export const dynamic = "force-dynamic";

type Backtest = {
  cases: number; fraud_rate_by_trigger: Record<string, number>; pattern_accuracy_on_confirmed_fraud: number;
  pattern_recall: Record<string, { n: number; correct: number; recall: number; top_confusions: [string, number][] }>;
};

export default function Evaluation() {
  const b = insight<Backtest | null>("backtest", null);
  const audit = insight<Record<string, string[]>>("audit", {});
  const violations = Object.values(audit).reduce((a, v) => a + v.length, 0);
  const CHANGES: [string, string][] = [
    ["Card-present match flags", "M5/M6 = “F” appears on 31–59% of confirmed takeover / out-of-region cases but 4–7% of cleared alerts; a never-seen region is more common on cleared alerts (trips). Card-present alerts now use the flags; rare-region share splits out-of-region from takeover."],
    ["Ring rule tightened", "“Shared device + prior fraud” mislabelled ~300 ordinary card-not-present cases. A ring now needs a device new to the account, an anonymous/hidden proxy, and sharing across customers — still 9 of 9 on documented ring cases. Removed a false report on HHG-016."],
    ["Card testing generalised", "Real probe runs are sub-$1 authorisations spread over hours to days; a busy-profile guard ignores lone tiny charges on high-volume profiles."],
    ["Dispute scoping", "A customer disputing one charge exposes that charge only, unless a linked episode (testing, structuring, ring, a 2–4 purchase CNP burst) is found."],
  ];
  return (
    <Shell source="Backtest · 5,565 closed cases" crumbs={<span>Evaluation</span>}>
      <div className="mb-6 border-b border-border pb-5">
        <h1 className="font-serif text-[34px] leading-tight">Evaluation</h1>
        <p className="mt-1 max-w-3xl text-[13px] text-muted-foreground">
          The agent was replayed on every closed investigation from July to October — whose outcomes are known — with case memory cut off at each case&apos;s open time, so an alert can never retrieve itself. Every answer file is also audited against Fraud Policy v1.0.
        </p>
      </div>
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          ["Closed cases replayed", b ? b.cases.toLocaleString("en-US") : "—"],
          ["Pattern accuracy (confirmed fraud)", b ? `${(b.pattern_accuracy_on_confirmed_fraud * 100).toFixed(1)}%` : "—"],
          ["First measurement (first 400 cases)", "39.2%"],
          ["Policy-audit violations (20 cases)", violations.toString()],
        ].map(([k, v]) => (
          <Card key={k} className="p-4">
            <Label>{k}</Label>
            <div className={cn("mt-2 text-[28px] font-semibold tabular-nums", k.startsWith("Policy") && violations === 0 && "text-risk-low")}>{v}</div>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <PanelHeader title="Pattern recognition by pattern" />
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-4 py-2 font-medium">Pattern</th>
                <th className="px-4 py-2 text-right font-medium">Cases</th>
                <th className="px-4 py-2 font-medium">Recognised</th>
                <th className="px-4 py-2 font-medium">Most often confused with</th>
              </tr>
            </thead>
            <tbody>
              {b &&
                Object.entries(b.pattern_recall).map(([p, v]) => (
                  <tr key={p} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2.5">{p.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{v.n}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-28 bg-muted">
                          <div className={cn("h-full", v.recall >= 0.6 ? "bg-risk-low" : v.recall >= 0.3 ? "bg-risk-medium" : "bg-risk-critical")} style={{ width: `${v.recall * 100}%` }} />
                        </div>
                        <span className="tabular-nums">{Math.round(v.recall * 100)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {v.top_confusions
                        .filter(([k]) => k !== p)
                        .slice(0, 2)
                        .map(([k, n]) => `${k.replace(/_/g, " ")} (${n})`)
                        .join(", ") || "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </Card>
        <div className="space-y-4 xl:col-span-5">
          <Card className="p-4">
            <Label>What the history can and can&apos;t measure</Label>
            <p className="mt-2 text-[13px] leading-6">
              In the closed cases the trigger alone predicts the outcome — fraud rate {b ? Object.entries(b.fraud_rate_by_trigger).map(([k, v]) => `${k.replace("_", " ")} ${Math.round(v * 100)}%`).join(", ") : "—"}. So fraud-versus-legitimate accuracy isn&apos;t measurable here without measuring the trigger; we report pattern accuracy, which is.
            </p>
          </Card>
          <Card>
            <PanelHeader title="What the backtest changed" />
            <div className="divide-y divide-border/60">
              {CHANGES.map(([t, d]) => (
                <div key={t} className="p-4">
                  <div className="text-[13.5px] font-medium">{t}</div>
                  <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">{d}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
