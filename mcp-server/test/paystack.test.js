// The real Paystack client against a stubbed fetch: request shape and failure modes.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { createPaystackClient } from "../src/paystack.js";

const realFetch = globalThis.fetch;
afterEach(() => (globalThis.fetch = realFetch));

const reply = (status, body) => async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("refuses live keys and missing keys", () => {
  assert.throws(() => createPaystackClient({ secretKey: "sk_live_abc" }), /must be a test key/);
  assert.throws(() => createPaystackClient({}), /not set/);
});

test("initialize sends kobo amount, NGN and bearer key", async () => {
  let seen;
  globalThis.fetch = async (url, init) => {
    seen = { url, init };
    return reply(200, { status: true, data: { authorization_url: "https://checkout.paystack.com/x", reference: "MT-1" } })();
  };
  const ps = createPaystackClient({ secretKey: "sk_test_abc" });
  const data = await ps.initialize({ email: "a@b.co", amountKobo: 305000, reference: "MT-1", metadata: {} });
  assert.equal(data.authorization_url, "https://checkout.paystack.com/x");
  assert.equal(seen.url, "https://api.paystack.co/transaction/initialize");
  assert.equal(seen.init.headers.Authorization, "Bearer sk_test_abc");
  assert.deepEqual(JSON.parse(seen.init.body), { email: "a@b.co", amount: 305000, currency: "NGN", reference: "MT-1", metadata: {} });
});

test("maps Paystack failures to typed errors", async () => {
  const ps = createPaystackClient({ secretKey: "sk_test_abc" });

  globalThis.fetch = reply(400, { status: false, message: "Transaction reference not found" });
  await assert.rejects(ps.verify("MT-X"), { kind: "not_found" });

  globalThis.fetch = reply(503, { status: false, message: "Service unavailable" });
  await assert.rejects(ps.verify("MT-X"), { kind: "api", retryable: true });

  globalThis.fetch = reply(401, { status: false, message: "Invalid key" });
  await assert.rejects(ps.verify("MT-X"), { kind: "api", retryable: false });

  globalThis.fetch = async () => new Response("<html>bad gateway</html>", { status: 502 });
  await assert.rejects(ps.verify("MT-X"), { kind: "api", retryable: true });

  globalThis.fetch = async () => {
    throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
  };
  await assert.rejects(ps.verify("MT-X"), { kind: "timeout", retryable: true });

  globalThis.fetch = async () => {
    throw new TypeError("fetch failed");
  };
  await assert.rejects(ps.verify("MT-X"), { kind: "network", retryable: true });
});
