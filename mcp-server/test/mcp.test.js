// End-to-end over real HTTP with the official MCP client, the same path Chord uses.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createApp } from "../src/application.js";
import { createPaystackClient } from "../src/paystack.js";

const TOKEN = "test-token";
let httpServer, baseUrl, paystack;

before(async () => {
  paystack = createPaystackClient({ mode: "mock" });
  const app = createApp({ env: { MCP_AUTH_TOKEN: TOKEN }, paystack });
  httpServer = app.listen(0);
  await new Promise((r) => httpServer.once("listening", r));
  baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
});
after(() => httpServer.close());

async function connect(token = TOKEN) {
  const client = new Client({ name: "test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
}

const parse = (result) => JSON.parse(result.content[0].text);

function futureWeekday(daysAhead = 3) {
  const d = new Date(Date.now() + daysAhead * 864e5);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

test("rejects a wrong bearer token", async () => {
  await assert.rejects(connect("wrong"));
});

test("accepts a client that only sends Accept: application/json", async () => {
  const res = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).result.tools.length, 4);
});

test("lists the four tools", async () => {
  const client = await connect();
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ["check_payment", "create_payment_link", "get_menu", "quote_order"]);
  await client.close();
});

test("full order: quote -> link -> not paid -> paid", async () => {
  const client = await connect();
  const order = { items: [{ item_id: "tray-50", quantity: 1 }], delivery_zone: "mainland-near", delivery_date: futureWeekday() };

  const quote = parse(await client.callTool({ name: "quote_order", arguments: order }));
  assert.equal(quote.total_kobo, 2_800_000 + 250_000);

  const link = parse(
    await client.callTool({
      name: "create_payment_link",
      arguments: { ...order, customer_name: "Tolu Test", customer_phone: "+234 800 000 0001", delivery_address: "5 Fake St, Ikeja" },
    }),
  );
  assert.equal(link.status, "AWAITING_PAYMENT");
  assert.match(link.order_reference, /^MT-/);
  assert.equal(paystack._txns.get(link.order_reference).customer.email, "wa2348000000001@example.com");

  const before = parse(await client.callTool({ name: "check_payment", arguments: { order_reference: link.order_reference } }));
  assert.equal(before.status, "NOT_PAID_YET");

  paystack.settle(link.order_reference, "success");
  const paid = parse(await client.callTool({ name: "check_payment", arguments: { order_reference: link.order_reference.toLowerCase() } }));
  assert.equal(paid.status, "PAID");
  assert.equal(paid.order.delivery_address, "5 Fake St, Ikeja");
  await client.close();
});

test("declined payment, amount mismatch and unknown reference", async () => {
  const client = await connect();
  const order = { items: [{ item_id: "tray-25", quantity: 1 }], delivery_zone: "pickup", delivery_date: futureWeekday() };
  const mk = async () =>
    parse(await client.callTool({ name: "create_payment_link", arguments: { ...order, customer_name: "A", customer_phone: "08000000002" } }));

  const declined = await mk();
  paystack.settle(declined.order_reference, "failed");
  assert.equal(parse(await client.callTool({ name: "check_payment", arguments: { order_reference: declined.order_reference } })).status, "FAILED");

  const tampered = await mk();
  paystack.settle(tampered.order_reference, "success");
  paystack._txns.get(tampered.order_reference).amount = 100; // paid ₦1 instead of the total
  assert.equal(
    parse(await client.callTool({ name: "check_payment", arguments: { order_reference: tampered.order_reference } })).status,
    "AMOUNT_MISMATCH",
  );

  assert.equal(parse(await client.callTool({ name: "check_payment", arguments: { order_reference: "MT-20260101-NOPE00" } })).status, "NOT_FOUND");
  await client.close();
});

test("delivery order without address is refused before charging", async () => {
  const client = await connect();
  const res = parse(
    await client.callTool({
      name: "create_payment_link",
      arguments: { items: [{ item_id: "tray-50", quantity: 1 }], delivery_zone: "island", delivery_date: futureWeekday(), customer_name: "B", customer_phone: "08000000003" },
    }),
  );
  assert.equal(res.status, "MISSING_ADDRESS");
  await client.close();
});
