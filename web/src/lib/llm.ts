import Anthropic from "@anthropic-ai/sdk";
import type { Finding, Dispute, Recommendation, FraudCase } from "./types";
import type { PolicyChunk } from "./rag";

export const LLM_MODEL = "claude-opus-5";
const enabled = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = enabled ? new Anthropic() : null;

/**
 * The LLM narrates; it never decides. It receives the graph-derived findings, the challenger's disputes
 * and the orchestrator's policy-bound recommendation, and writes an analyst-facing explanation.
 */
export async function narrate(c: FraudCase, findings: Finding[], disputes: Dispute[], rec: Recommendation, policy: PolicyChunk[] = []): Promise<string | null> {
  if (!client) return null;
  const context = JSON.stringify({
    case: { id: c.id, trigger: c.triggerDetail, customer: c.customer },
    findings: findings.map(({ agent, title, detail, logOdds, source }) => ({ agent, title, detail, logOdds, source })),
    disputes: disputes.map(({ argument, upheld }) => ({ argument, upheld })),
    policy_passages: policy.map(({ doc, section, text }) => ({ doc, section, text })),
    recommendation: { stage: rec.stage, assessment: rec.assessment, actions: rec.actions.map(({ label, approval, policyRef }) => ({ label, approval, policyRef })), evidenceRequest: rec.evidenceRequest },
  });
  try {
    const res = await client.beta.messages.create({
      model: LLM_MODEL,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low" },
      system:
        "You are the explanation layer of a bank fraud-investigation agent. Using ONLY the JSON evidence and policy passages provided (cite policy sections by name), write a 3-4 sentence analyst-facing explanation: what evidence drove the assessment, what uncertainty remains and why, and why these actions and approval routes were chosen. Do not invent facts. Plain prose, no headings.",
      messages: [{ role: "user", content: context }],
    });
    if (res.stop_reason === "refusal") return null;
    return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim() || null;
  } catch (e) {
    console.error("narrate failed", e);
    return null;
  }
}
