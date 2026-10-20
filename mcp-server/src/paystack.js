// Thin Paystack client: initialize a transaction, verify it by reference.
// Docs: https://paystack.com/docs/api/transaction/
//
// PAYSTACK_MODE=mock swaps in an in-memory fake so the server and tests run
// without a Paystack account. The mock keeps state in process memory, so it is
// for local runs only; deploy with a real sk_test_ key.

export class PaystackError extends Error {
  constructor(message, { kind, retryable = false, status } = {}) {
    super(message);
    this.kind = kind; // "config" | "timeout" | "network" | "api" | "not_found"
    this.retryable = retryable;
    this.status = status;
  }
}

const TIMEOUT_MS = 10_000;

export function createPaystackClient({ secretKey, mode = "live-api", baseUrl = "https://api.paystack.co", publicBaseUrl } = {}) {
  if (mode === "mock") return createMockClient({ publicBaseUrl });

  if (!secretKey) {
    throw new PaystackError("PAYSTACK_SECRET_KEY is not set.", { kind: "config" });
  }
  // Ground rule for this exercise, and a sane default for any demo: never move real money.
  if (!secretKey.startsWith("sk_test_")) {
    throw new PaystackError("Refusing to start: PAYSTACK_SECRET_KEY must be a test key (sk_test_...).", { kind: "config" });
  }

  async function call(method, path, body) {
    let res;
    try {
      res = await fetch(baseUrl + path, {
        method,
        headers: { Authorization: `Bearer ${secretKey}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      if (err.name === "TimeoutError") {
        throw new PaystackError(`Paystack did not answer within ${TIMEOUT_MS / 1000}s.`, { kind: "timeout", retryable: true });
      }
      throw new PaystackError(`Could not reach Paystack: ${err.message}`, { kind: "network", retryable: true });
    }

    let json;
    try {
      json = await res.json();
    } catch {
      throw new PaystackError(`Paystack returned HTTP ${res.status} with a non-JSON body.`, {
        kind: "api",
        status: res.status,
        retryable: res.status >= 500,
      });
    }

    if (!res.ok || json.status !== true) {
      const message = json?.message ?? `HTTP ${res.status}`;
      if (/reference not found/i.test(message) || res.status === 404) {
        throw new PaystackError(message, { kind: "not_found", status: res.status });
      }
      throw new PaystackError(`Paystack error: ${message}`, {
        kind: "api",
        status: res.status,
        retryable: res.status >= 500 || res.status === 429,
      });
    }
    return json.data;
  }

  return {
    mode: "paystack-test",
    initialize: ({ email, amountKobo, reference, metadata }) =>
      call("POST", "/transaction/initialize", {
        email,
        amount: amountKobo,
        currency: "NGN",
        reference,
        metadata,
      }),
    verify: (reference) => call("GET", `/transaction/verify/${encodeURIComponent(reference)}`),
  };
}

function createMockClient({ publicBaseUrl = "http://localhost:3000" } = {}) {
  const txns = new Map();
  return {
    mode: "mock",
    _txns: txns,
    async initialize({ email, amountKobo, reference, metadata }) {
      txns.set(reference, {
        reference,
        amount: amountKobo,
        currency: "NGN",
        status: "abandoned", // Paystack reports unpaid checkouts as "abandoned"
        gateway_response: "The transaction was not completed",
        customer: { email },
        metadata,
        paid_at: null,
      });
      return { authorization_url: `${publicBaseUrl}/mock-pay/${reference}`, access_code: "mock", reference };
    },
    async verify(reference) {
      const t = txns.get(reference);
      if (!t) throw new PaystackError("Transaction reference not found", { kind: "not_found", status: 400 });
      return t;
    },
    /** Test hook: simulate the customer completing (or failing) checkout. */
    settle(reference, outcome) {
      const t = txns.get(reference);
      if (!t) return false;
      if (outcome === "success") Object.assign(t, { status: "success", gateway_response: "Approved", paid_at: new Date().toISOString() });
      else Object.assign(t, { status: "failed", gateway_response: "Declined" });
      return true;
    },
  };
}
