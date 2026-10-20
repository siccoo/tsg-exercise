# Mama T's order desk: a Chord teammate that takes WhatsApp orders and checks payment with Paystack

A Chord teammate for a (fictional) Lagos small-chops kitchen. It takes an order
on WhatsApp, quotes the exact price from the real menu, sends a Paystack
test-mode payment link, and confirms the order only after Paystack confirms the
money arrived. A screenshot of a transfer is never accepted as proof.

```
WhatsApp customer ──> Chord teammate (skill: mama-t-orders)
                            │  MCP over HTTPS, bearer token
                            v
                  mama-t-orders MCP server (this repo, on Vercel)
                            │  REST, sk_test_ key
                            v
                     Paystack test mode
```

## What's here

| Path | What it is |
|---|---|
| `skill/mama-t-orders/` | The Chord skill: `SKILL.md` (instructions) plus `references/` (business context, edge-case playbook) |
| `mcp-server/` | The custom tool: a Node MCP server with 4 tools, deployed to a public HTTPS URL |
| `SUBMISSION.md` | Role, problem statement and links to all six deliverables |
| `docs/CHORD_SETUP.md` | Step-by-step: deploy the server, create the teammate, connect the tool, test |
| `docs/FIELD_NOTES.md` | Problems hit while building and deploying, and what Chord could change |
| `docs/GO_LIVE_NOTE.md` | Half-page handover for the business owner |
| `docs/DEMO_SCRIPT.md` | Script for the 3-minute recording |

## The tools

| Tool | Calls | Why it exists |
|---|---|---|
| `get_menu` | none | Prices, zones and rules from one place, so the model never quotes from memory |
| `quote_order` | none | Validates items, zone, date, notice period and minimum order, and does the arithmetic in code, not in the model |
| `create_payment_link` | Paystack `POST /transaction/initialize` | Recomputes the total server-side (the model can't change the amount), stores the order in Paystack metadata, returns the checkout link |
| `check_payment` | Paystack `GET /transaction/verify/:ref` | The only proof of payment. Handles paid, declined, not-yet-paid, wrong amount, reversed and unknown reference |

Design choices worth knowing:

- **Stateless.** The order lives in the Paystack transaction's metadata, so
  there's no database to run. The trade-off: there's no order list outside
  Paystack's dashboard (see the go-live note).
- **Money is integer kobo end to end.** The model only ever sees formatted
  naira strings.
- **Business outcomes vs failures.** A declined card is a normal result with
  guidance for the agent. A Paystack outage or bad key is an MCP `isError`
  result telling the agent to escalate and never confirm.
- **Test keys only.** The server refuses to start with an `sk_live_` key.
- **Auth.** Chord sends a bearer token (`MCP_AUTH_TOKEN`); every other caller
  gets 401.

## Run it locally

Needs Node 20+.

```bash
cd mcp-server
npm install
npm test                       # 15 tests: pricing rules, Paystack errors, full MCP flow over HTTP
npm run dev                    # mock Paystack, no key needed, http://localhost:3000/mcp
```

With real Paystack test mode:

```bash
cp .env.example .env           # fill PAYSTACK_SECRET_KEY (sk_test_...) and MCP_AUTH_TOKEN
node --env-file=.env server.js
```

Chord can't reach `localhost`. For a quick public URL use
`npx cloudflared tunnel --url http://localhost:3000`, or deploy (below).

## Deploy

```bash
cd mcp-server
npx vercel deploy --prod
npx vercel env add PAYSTACK_SECRET_KEY production
npx vercel env add MCP_AUTH_TOKEN production
npx vercel deploy --prod       # redeploy so the env vars apply
curl https://<your-app>.vercel.app/healthz   # {"ok":true,"paystack_mode":"paystack-test"}
```

Then follow `docs/CHORD_SETUP.md` to connect it to the teammate.

## Testing a payment

Paystack test card: `4084 0840 8408 4081`, any future expiry, CVV `408`, PIN
`0000`, OTP `123456`. To test a decline, use Paystack's failed-transaction test
card from their [test payments docs](https://paystack.com/docs/payments/test-payments/).

## How I used AI tools

I used Claude (Claude Code) as a pair programmer. It read the Chord docs with
me, scaffolded the MCP server and tests, and drafted the skill and docs. I
chose the business problem, reviewed and edited every file, ran the tests, and
did the deployment and Chord setup myself. The field notes are from my own
build. The Accept-header 406 in the field notes was found by testing the
server with curl during that session.
