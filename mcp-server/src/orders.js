import { MENU, DELIVERY_ZONES, RULES, findItem, findZone, formatNaira } from "./catalog.js";

const LAGOS_UTC_OFFSET_HOURS = 1; // Africa/Lagos is UTC+1 all year, no DST
const FIRST_DELIVERY_HOUR = 10;

/** Moment the first delivery slot opens on a YYYY-MM-DD date, as a UTC Date. */
function firstSlotOn(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, FIRST_DELIVERY_HOUR - LAGOS_UTC_OFFSET_HOURS));
}

function isValidDateString(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Validate an order and price it. Never throws for bad customer input:
 * returns { ok: false, problems: [...] } so the agent can explain each problem
 * to the customer in plain words.
 */
export function quoteOrder({ items, delivery_zone, delivery_date }, now = new Date()) {
  const problems = [];
  const lines = [];

  if (!Array.isArray(items) || items.length === 0) {
    problems.push("The order has no items.");
  }

  // Merge duplicate lines ("2 trays" then "1 more tray") into one quantity.
  const merged = new Map();
  for (const { item_id, quantity } of items ?? []) {
    merged.set(item_id, (merged.get(item_id) ?? 0) + quantity);
  }

  let maxLeadHours = 0;
  for (const [item_id, quantity] of merged) {
    const item = findItem(item_id);
    if (!item) {
      problems.push(`"${item_id}" is not on the menu. Valid item ids: ${MENU.map((m) => m.id).join(", ")}.`);
      continue;
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      problems.push(`Quantity for ${item.name} must be a whole number of at least 1.`);
      continue;
    }
    if (quantity > RULES.max_quantity_per_item) {
      problems.push(
        `${quantity} x ${item.name} is above the ${RULES.max_quantity_per_item} we take on WhatsApp. ` +
          "Large orders need Mama T to confirm capacity: escalate to a human.",
      );
      continue;
    }
    maxLeadHours = Math.max(maxLeadHours, item.lead_time_hours);
    lines.push({
      item_id,
      name: item.name,
      quantity,
      unit_price_kobo: item.price_kobo,
      line_total_kobo: item.price_kobo * quantity,
    });
  }

  const zone = findZone(delivery_zone);
  if (!zone) {
    problems.push(`Unknown delivery zone "${delivery_zone}". Valid zones: ${DELIVERY_ZONES.map((z) => z.id).join(", ")}.`);
  }

  if (!isValidDateString(delivery_date)) {
    problems.push(`Delivery date "${delivery_date}" must be a real date in YYYY-MM-DD format.`);
  } else {
    const slot = firstSlotOn(delivery_date);
    const hoursAhead = (slot - now) / 36e5;
    const weekday = new Date(`${delivery_date}T12:00:00Z`).getUTCDay();
    if (RULES.closed_weekdays.includes(weekday)) {
      problems.push("We don't deliver on Sundays. Please pick Monday to Saturday.");
    }
    if (hoursAhead < maxLeadHours) {
      problems.push(
        `This order needs at least ${maxLeadHours} hours' notice before the 10:00 delivery slot; ` +
          `${delivery_date} is too soon. Suggest a later date.`,
      );
    }
    if (hoursAhead > RULES.max_days_ahead * 24) {
      problems.push(`We only take orders up to ${RULES.max_days_ahead} days ahead.`);
    }
  }

  const subtotal = lines.reduce((s, l) => s + l.line_total_kobo, 0);
  if (lines.length > 0 && subtotal < RULES.minimum_order_kobo) {
    problems.push(
      `The minimum order is ${formatNaira(RULES.minimum_order_kobo)} before delivery; this order is ${formatNaira(subtotal)}.`,
    );
  }

  if (problems.length > 0) return { ok: false, problems };

  const deliveryFee = zone.fee_kobo;
  const total = subtotal + deliveryFee;
  return {
    ok: true,
    lines: lines.map((l) => ({
      ...l,
      unit_price: formatNaira(l.unit_price_kobo),
      line_total: formatNaira(l.line_total_kobo),
    })),
    delivery_zone: zone.id,
    delivery_zone_name: zone.name,
    delivery_date,
    subtotal_kobo: subtotal,
    delivery_fee_kobo: deliveryFee,
    total_kobo: total,
    summary:
      lines.map((l) => `${l.quantity} x ${l.name} = ${formatNaira(l.line_total_kobo)}`).join("\n") +
      `\nDelivery (${zone.name}) = ${formatNaira(deliveryFee)}` +
      `\nTotal = ${formatNaira(total)}`,
  };
}

/** Order reference shown to the customer and used as the Paystack reference. */
export function newOrderReference(now = new Date()) {
  const ymd = now.toISOString().slice(0, 10).replaceAll("-", "");
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `MT-${ymd}-${rand}`;
}
