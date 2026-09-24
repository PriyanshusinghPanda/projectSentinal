# Sentinel demo — narration script (3:08)

Read at a calm, even pace (~2.4 words/second). Each block has a time window and a word budget that fits it.
Record one take per block (or one continuous take with a short pause between blocks), save as
`public/vo/full.wav` (or per-block `public/vo/01.wav` …) and Claude will drop it in and re-render.

---

**1 · Title — 0:00–0:07** (~14 words)
> This is Sentinel — an agent that investigates card-fraud alerts the way an analyst would.

**2 · The problem — 0:07–0:25** (~40 words)
> The bank's data has five hundred ninety thousand transactions, each with a model risk score. But above zero point seven, most flagged transactions are legitimate — and some fraud scores near zero. Half of the exam cases aren't fraud at all. Blocking on the score alone fails.

**3 · How it works — 0:25–0:58** (~75 words)
> Everything lives in TigerGraph: customers, cards, transactions, device profiles, billing regions, and five and a half thousand closed cases. The agents reach it through TigerGraph MCP — our GSQL queries are exposed as tools. Specialist agents gather evidence from the card, the device, and the wider graph. Then a Challenger argues the innocent explanation. The Orchestrator sets a probability, asks for evidence when it's unsure, and maps every action to the bank's fraud policy and its approval route. Finally, each investigation is written back to the graph as memory.

**4 · Live demo card — 0:58–1:01** (~6 words)
> Here's the console, running live.

**5 · Console — 1:01–1:15** (~30 words)
> The landing page explains the method. The console holds the twenty exam cases, sorted by assessed fraud probability. Let's open HHG-005 — a hundred-dollar online purchase the model scored at point five four.

**6 · HHG-005 — 1:15–1:45** (~70 words)
> The specialists query the graph: the card's history fits, but the device is new — and this customer has three earlier cases confirmed as fraud. The Challenger pushes back: people buy new phones. On one weak signal, the probability is point three five, so policy rule R1 says verify before blocking. The customer denies the purchase. Probability jumps to point eight eight, and the action becomes block the card — routed to a team lead, who approves it. Every step is on the record.

**7 · HHG-014 — 1:45–2:10** (~58 words)
> HHG-014 came from an analyst. The same Samsung device profile, behind an anonymous proxy, was used on twenty-eight other customers' cards in a month. It fits none of the five documented patterns, so the agent describes it in its own words. The result: block, monitor every connected card, and file a suspicious activity report — which needs a fraud manager's approval.

**8 · Under the hood — 2:10–2:36** (~58 words)
> Under the hood, the full dataset is in TigerGraph Savanna — over two point three million edges. The agent's graph questions, like device neighbors, are installed GSQL queries called through MCP. And all twenty investigations are written back as case vertices, so the next alert can find them.

**9 · Results — 2:36–2:58** (~50 words)
> Across the twenty cases: eleven fraud, eight legitimate, one escalated. The agent asked for evidence in every case, and nineteen recommendations changed once it arrived. Two reports were filed — for two schemes no documented pattern covers. And on five and a half thousand historical cases, it names the right pattern sixty-three percent of the time.

**10 · Outro — 2:58–3:08** (~18 words)
> Sentinel. Built on TigerGraph, MCP and GraphRAG. The code is on GitHub — thanks for watching.
