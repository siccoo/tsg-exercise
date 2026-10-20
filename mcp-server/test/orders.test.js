import { test } from "node:test";
import assert from "node:assert/strict";
import { quoteOrder, newOrderReference } from "../src/orders.js";

// Monday 19 Oct 2026, 12:00 Lagos time
const NOW = new Date("2026-10-19T11:00:00Z");

test("prices a valid order with delivery", () => {
  const q = quoteOrder(
    { items: [{ item_id: "tray-50", quantity: 2 }, { item_id: "chapman-1.5l", quantity: 3 }], delivery_zone: "island", delivery_date: "2026-10-21" },
    NOW,
  );
  assert.equal(q.ok, true);
  assert.equal(q.subtotal_kobo, 2 * 2_800_000 + 3 * 450_000);
  assert.equal(q.delivery_fee_kobo, 650_000);
  assert.equal(q.total_kobo, 5_600_000 + 1_350_000 + 650_000);
  assert.match(q.summary, /Total = ₦76,000/);
});

test("merges duplicate lines", () => {
  const q = quoteOrder(
    { items: [{ item_id: "tray-25", quantity: 1 }, { item_id: "tray-25", quantity: 1 }], delivery_zone: "pickup", delivery_date: "2026-10-21" },
    NOW,
  );
  assert.equal(q.lines.length, 1);
  assert.equal(q.lines[0].quantity, 2);
});

test("rejects unknown item, unknown zone, Sunday and short notice together", () => {
  const sunday = quoteOrder({ items: [{ item_id: "jollof", quantity: 1 }], delivery_zone: "abuja", delivery_date: "2026-10-25" }, NOW);
  assert.equal(sunday.ok, false);
  assert.ok(sunday.problems.some((p) => p.includes('"jollof" is not on the menu')));
  assert.ok(sunday.problems.some((p) => p.includes("Unknown delivery zone")));
  assert.ok(sunday.problems.some((p) => p.includes("Sundays")));

  const tooSoon = quoteOrder({ items: [{ item_id: "tray-100", quantity: 1 }], delivery_zone: "pickup", delivery_date: "2026-10-20" }, NOW);
  assert.equal(tooSoon.ok, false);
  assert.ok(tooSoon.problems.some((p) => p.includes("48 hours")));
});

test("enforces minimum order and quantity cap", () => {
  const small = quoteOrder({ items: [{ item_id: "chapman-1.5l", quantity: 1 }], delivery_zone: "pickup", delivery_date: "2026-10-22" }, NOW);
  assert.ok(small.problems.some((p) => p.includes("minimum order")));
  const huge = quoteOrder({ items: [{ item_id: "tray-25", quantity: 21 }], delivery_zone: "pickup", delivery_date: "2026-10-22" }, NOW);
  assert.ok(huge.problems.some((p) => p.includes("escalate")));
});

test("rejects impossible dates", () => {
  const q = quoteOrder({ items: [{ item_id: "tray-50", quantity: 1 }], delivery_zone: "pickup", delivery_date: "2026-02-30" }, NOW);
  assert.ok(q.problems.some((p) => p.includes("real date")));
});

test("order reference format", () => {
  assert.match(newOrderReference(NOW), /^MT-20261019-[A-Z0-9]{6}$/);
});
