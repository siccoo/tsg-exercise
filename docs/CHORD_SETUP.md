# Setting up the agent on Chord

Order matters: deploy the tool first, so the teammate can use it as soon as it exists.

## 0. Accounts (do these first)

1. Create a Chord account at https://www.chordhq.xyz/login and email the address
   to your TSG Labs contact. The 5-day clock starts when they add credits.
2. Create a free Paystack account at https://paystack.com. Test mode works
   without business verification. Copy the **test** secret key (`sk_test_...`)
   from Settings → API Keys & Webhooks.
3. Have a Vercel account (or Render/Railway; any public HTTPS host works).

## 1. Deploy the MCP server

```bash
cd mcp-server
npm install && npm test
openssl rand -hex 32          # this is your MCP_AUTH_TOKEN; keep it
npx vercel deploy --prod
npx vercel env add PAYSTACK_SECRET_KEY production
npx vercel env add MCP_AUTH_TOKEN production
npx vercel deploy --prod
```

Check it:

```bash
URL=https://<your-app>.vercel.app
curl $URL/healthz
curl -s $URL/mcp -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | head -c 300
```

You should see the four tool names. If Vercel shows a login page instead of
JSON, turn off Deployment Protection for production
(Project → Settings → Deployment Protection).

## 2. Create the teammate from the skill

1. Zip the skill folder:
   `cd skill && zip -r mama-t-orders.zip mama-t-orders`
2. In Chord: **Teammates → Create a teammate**. Upload the zip (or the folder).
3. On review, check that `SKILL.md` has the **Instructions** badge and both
   `references/` files are listed. Name: `Tobi – Mama T's Orders`.
4. Create. The teammate starts paused; activate it (an admin may need to).

## 3. Connect the tool

In the app: **Teammate settings (gear) → Tools → Add tool**, add an MCP server:

| Field | Value |
|---|---|
| Name | `Mama T orders` |
| URL | `https://<your-app>.vercel.app/mcp` |
| Auth | Bearer, token = your `MCP_AUTH_TOKEN` |
| Transport | Streamable HTTP |

Make sure it shows **On** for the teammate (not "Needs connecting").

Same thing over the API, if you have a key with `mcp:create`, `mcp:read`,
`mcp:manage`, `teammate:update`:

```bash
curl -sS -X POST "$CHORD_BASE_URL/v1/workspaces/$CHORD_WORKSPACE_ID/mcp-servers" \
  -H "Authorization: Bearer $CHORD_API_KEY" -H 'Content-Type: application/json' \
  --data '{"name":"Mama T orders","url":"https://<your-app>.vercel.app/mcp","auth_type":"bearer","auth_token":"<MCP_AUTH_TOKEN>","transport":"streamable_http","enabled":true}'
# then, with the returned mcp-... id:
curl -sS -X POST "$CHORD_BASE_URL/v1/workspaces/$CHORD_WORKSPACE_ID/mcp-servers/$MCP_ID/health" -H "Authorization: Bearer $CHORD_API_KEY"
curl -sS -X PUT "$CHORD_BASE_URL/v1/teammates/$CHORD_TEAMMATE_ID" -H "Authorization: Bearer $CHORD_API_KEY" \
  -H 'Content-Type: application/json' --data '{"set_mcp_server_ids":["'$MCP_ID'"]}'
```

The health call returns HTTP 200 even when it fails, so read `status`.

## 4. Test in the app, then in the WhatsApp simulator

1. In the teammate's in-app chat, send: *"Hi, I need small chops for 15 people
   on Saturday, delivered to Yaba."*
2. Watch the Vercel logs (`npx vercel logs <url>`): each tool call prints one
   JSON line (`get_menu`, `quote_order`, ...). No lines means the tool never
   ran. Note that in your field notes.
3. Open the simulator at https://chat.tsglabs.dev/, pick the teammate, and run
   the full script in `DEMO_SCRIPT.md`, including paying with the test card.
4. Check the Paystack test dashboard: the transaction is there with the order
   reference and metadata.

**Keep a log as you go.** Every error message, screenshot and "huh?" moment
belongs in `FIELD_NOTES.md`.
