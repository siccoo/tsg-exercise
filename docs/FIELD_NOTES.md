# Deployment field notes

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

## 3. Tobi said the tools were down, but Chord had a login-protected URL

**What happened.** With the teammate created and the MCP tool connected, my
first in-app test message ("Hi, I need small chops for 15 people on Saturday,
delivered to Yaba") got this reply:

> I can't pull up the menu or prices right now, because the ordering system
> (the tools I use for the menu, quotes and payment links) isn't reachable this
> turn. It looks like a temporary platform issue.

It did the right thing: it refused to quote prices from memory, kept the order
details (15 people, Saturday 24 October, Yaba) and asked for the delivery time.
But "temporary platform issue" was wrong. Nothing was down.

**How I worked out the cause.** I sent the same `tools/list` call to both of the
project's Vercel URLs, using my token:

- `https://mama-t-whatsapp-order.vercel.app/mcp` returned all four tools.
- `https://mama-t-whatsapp-order-siccoos-projects.vercel.app/mcp`, the
  team-scoped URL, returned `401 {"message":"Protected by Vercel
  Authentication", ...}` and never reached my server.

Chord had the team-scoped URL. Vercel shows that URL next to the project, and it
looks just as "production" as the short one, but Deployment Protection puts it
behind a Vercel login. Every tool call from Chord hit that login wall.

**Fix.** I changed the tool's URL in Chord to
`https://mama-t-whatsapp-order.vercel.app/mcp`. The next test reached the tools
and Tobi quoted from the real menu.

**What I'd change in Chord.** When a tool call fails, tell the builder why. The
agent turned an HTTP 401 from a login page into "a temporary platform issue",
which sent me looking for an outage that wasn't there. In the builder console,
show the failed call's HTTP status and the first part of the response body. When
a tool is saved, run a `tools/list` call and refuse a URL that answers with a
login page or a non-JSON-RPC body, with a hint about hosting protection
(Vercel, Netlify and Cloudflare Access all do this).
