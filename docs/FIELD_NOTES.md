# Deployment field notes

> **Michael, read this first (delete this box before submitting).** Notes 1 and 2
> are real: they came up while the code was being built. Notes 3+ are empty
> slots for what you hit while deploying on Chord, which you haven't done yet.
> Don't invent problems. TSG says 2–3 specific, real notes beat a long list,
> and you'll be asked about them live. While you deploy, copy every error
> message, take screenshots, and note the time. Delete the "Things to watch
> for" list before submitting.

---

## 1. The MCP server rejected plain-JSON clients with HTTP 406

**What happened.** I tested the deployed-style server with a plain
`curl -H 'Accept: application/json'` JSON-RPC `tools/list` call, the kind of
request Chord's docs describe ("Chord sends JSON POST requests and accepts JSON
or SSE"). It failed:

```
HTTP 406
{"jsonrpc":"2.0","error":{"code":-32000,"message":"Not Acceptable: Client must accept both application/json and text/event-stream"},"id":null}
```

The official MCP client in my test suite passed, because it sends both types.
So the tests were green while a differently behaved client would get 406 on
every tool call.

**How I found the cause.** The message comes from the MCP TypeScript SDK's
`StreamableHTTPServerTransport`. It enforces the MCP spec's requirement that
clients list both types in `Accept`. It does this even when the server is
configured to answer in plain JSON (`enableJsonResponse: true`).

**Fix.** A small Express middleware on `POST /mcp` normalises `Accept` to
`application/json, text/event-stream` before the transport sees it. It has to
rewrite `req.rawHeaders` as well as `req.headers`, because the SDK converts the
Node request to a Web `Request` from the raw headers. A regression test covers
it (`accepts a client that only sends Accept: application/json`).

**What I'd change in Chord.** State the exact request headers Chord's MCP client
sends (`Accept`, `MCP-Protocol-Version`, whether it calls `initialize` first)
on the MCP connections page. Have the health probe report the remote HTTP status
and body: today a failed probe comes back as HTTP 200 with
`status: "error"`, and builders need the 406 text to debug it in one step.
_[After deploying: check the Vercel logs to confirm what Accept header Chord
actually sends, and update this note with what you saw.]_

## 2. "Custom tool" in the brief means an MCP server, but nothing says so

**What happened.** The brief asks for "a custom tool that calls an external
system: Paystack, a public API, a Google Sheet, or a small mock API." I first
planned a plain REST API. Only after reading the API docs did it become clear
that Chord's only way to add your own tool is a remote MCP server over
Streamable HTTP at a public HTTPS URL. A REST endpoint or a Google Sheet can't
be connected as-is.

**How I worked it out.** The "Build your first teammate" guide only says
"Tools: Teammate settings → Tools … A tool must be both allowed and connected."
The MCP page is where the requirement lives: "Your server must support
Streamable HTTP at a public HTTPS URL… Private, loopback and internal addresses
are blocked." Connector tools (`connector_tool_types` like `bookings`) are a
separate built-in thing.

**Fix.** I wrapped Paystack in a small MCP server and hosted it on Vercel. I
built it stateless (new server per request, JSON responses) so it works on
serverless with no sessions to lose.

**What I'd change in Chord.** Add one line to the brief and to "Build your first
teammate": "Custom tools are remote MCP servers; here's a 40-line starter." A
starter template (MCP server + Vercel button) would save every candidate the
same hour. Also say whether localhost tunnels (cloudflared/ngrok) are allowed,
since "private addresses are blocked" makes people unsure.

## 3. _[Your first real Chord deployment problem]_

**What happened.** _(exact error text / screenshot, where in the UI or API)_

**How I worked out the cause.**

**How I fixed it or worked around it.**

**What I'd change in Chord, its docs or API.**

## 4. _[Optional second one]_

---

### Things to watch for while deploying (delete before submitting)

From reading the docs, these look like likely snags. Only write them up if they
actually happen to you:

- The simulator is a separate "Chord Connect" app that needs approval and
  consent. Does your teammate show up in it straight away?
- Skill zip upload: is `SKILL.md` marked Instructions automatically? Does the
  agent actually read `references/business.md`? ("Why this reply" is admin-only.)
- Teammate starts **paused** and "activation follows workspace permissions".
  Can you activate it yourself?
- Tool shows "Needs connecting" vs "On". Does the MCP server's bearer token
  save correctly? Does tool discovery list the 4 tools?
- Vercel Deployment Protection returns an HTML login page, not JSON. Chord's
  health check would see a non-MCP response.
- Does the agent call `check_payment` when the customer just says "I've paid",
  or does it answer without the tool? If so, you tightened `SKILL.md`: what changed?
- Credits: how many did one full test conversation cost? (Usage page / API.)
- Date handling: does the agent resolve "Saturday" to the right date?
