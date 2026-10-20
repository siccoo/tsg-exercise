# TSG Labs Build Exercise: Michael Chilaka

**Role:** Forward-deployed Engineering (also interested in Technical Product Management)

**Problem statement.** Mama T's Small Chops is a two-person Lagos catering
kitchen that takes about 90% of its orders on WhatsApp. The owner spends hours
quoting prices and checking bank transfer screenshots, and has lost whole party
trays to fake transfer alerts. The agent takes the order, prices it from the
real menu and rules, sends a Paystack link, and confirms only when Paystack's
API says the money arrived. That saves her evening admin time and stops the
fraud losses, which is why a small business would pay for it. I deliberately
left out delivery scheduling, refunds, editing paid orders and a kitchen
dashboard. Those go to a human, and the go-live note says what each would need.

| # | Deliverable | Where |
|---|---|---|
| 1 | Role + problem statement | This page |
| 2 | Working agent | Teammate **Tobi – Mama T's Orders** on Chord account `<your Chord email>`, live in the simulator |
| 3 | Code + README | `<GitHub repo link>`: `skill/`, `mcp-server/`, `README.md` |
| 4 | 3-minute recording | `<Drive link to video>` |
| 5 | Deployment field notes | `docs/FIELD_NOTES.md` |
| 6 | Go-live note | `docs/GO_LIVE_NOTE.md` |

To try it in the simulator: ask for a 50-piece tray for Saturday in Yaba, say
"I've paid" before paying (it should refuse to confirm), then pay with card
`4084 0840 8408 4081` / PIN `0000` / OTP `123456` and say "done".
