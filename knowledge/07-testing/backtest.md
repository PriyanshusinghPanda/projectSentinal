# Backtest on 5,565 closed cases

`agent/backtest.py` replays every closed investigation (July–October) as a new alert. Case memory is cut off at each
case's open time (`MEMORY_AS_OF`), so an alert can never retrieve itself.

## Finding 1 — fraud/legit separation isn't measurable on this history
Every model-scored closed case was cleared and every customer-reported one was fraud (fraud rate by trigger:
{'risk_score': 0.0, 'customer_report': 1.0, 'analyst_request': 0.0}), so the trigger alone predicts the outcome. The exam pack deliberately mixes them, so we
don't report an accuracy number that would really measure the trigger.

## Finding 2 — pattern recognition: 39% → 62.8%
Pattern the agent assigns once fraud is confirmed, against the analyst's label, on 4665 confirmed-fraud cases.

| Pattern | Cases | Recognised | Main confusions |
|---|---|---|---|
| account_takeover | 1205 | 21% | out_of_region_use (533), none (311) |
| card_not_present_fraud | 1404 | 92% | card_not_present_new_device (94), account_takeover (18) |
| card_not_present_new_device | 1076 | 67% | card_not_present_fraud (342), account_takeover (10) |
| card_testing | 16 | 12% | card_not_present_fraud (13), card_not_present_new_device (1) |
| out_of_region_use | 955 | 68% | none (201), account_takeover (102) |
| undocumented | 9 | 100% |  |

## What the backtest changed in the agent
- **Card-present match flags.** M5/M6 = "F" appears on 31–59% of confirmed takeover / out-of-region cases and on 4–7% of cleared alerts; a never-seen region is *more* common on cleared alerts (42%, trips). Card-present alerts now use the flags, and rare-region share / M4=M0 to split out-of-region from takeover.
- **Ring rule tightened.** "Shared device + prior fraud" mislabelled ~300 ordinary card-not-present cases as undocumented. A ring now needs a device new to the account, an anonymous/hidden proxy, and sharing across customers — still 9/9 on the documented ring cases. This removed a false report on exam case HHG-016.
- **Card testing generalised.** Real probe runs are sub-$1 authorisations spread over hours to days, not one tight hour; a busy-profile guard stops lone tiny charges on high-volume profiles from counting.
- **Dispute scoping.** A customer disputing one charge exposes that charge only, unless a linked episode (testing, structuring, ring, a 2–4 purchase CNP burst) is identified.

Every change was checked against `agent/policy_audit.py` (0 violations on the 20 answers).
