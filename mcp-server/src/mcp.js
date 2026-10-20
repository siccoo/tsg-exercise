import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { BUSINESS, MENU, DELIVERY_ZONES, RULES, formatNaira } from "./catalog.js";
import { quoteOrder, newOrderReference } from "./orders.js";
import { PaystackError } from "./paystack.js";

const itemsSchema = z
  .array(
    z.object({
      item_id: z.string().describe("Menu item id from get_menu, e.g. tray-50"),
      quantity: z.number().int().describe("How many of this item"),
    }),
  )
  .min(1)
  .describe("Items the customer wants");

const orderShape = {
  items: itemsSchema,
  delivery_zone: z.string().describe("Delivery zone id from get_menu, e.g. mainland-near, or pickup"),
  delivery_date: z.string().describe("Delivery date as YYYY-MM-DD (Lagos time)"),
};

const json = (obj) => ({ content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] });

// System failures (Paystack down, bad config) are tool errors; customer-facing
// outcomes such as a declined card are normal results the agent explains.
const toolError = (err) => ({
  isError: true,
  content: [
    {
      type: "text",
      text: JSON.stringify(
        {
          error: err.message,
          kind: err.kind ?? "internal",
          retryable: Boolean(err.retryable),
          agent_guidance: err.retryable
            ? "Payment system is temporarily unavailable. Apologise, say you'll try again in a minute, and try once more. If it fails again, escalate to a human and do not tell the customer the order is confirmed."
            : "Something is misconfigured on our side. Do not retry. Apologise, escalate to a human, and do not tell the customer the order is confirmed.",
        },
        null,
        2,
      ),
    },
  ],
});

function log(event) {
  console.log(JSON.stringify({ at: new Date().toISOString(), ...event }));
}

function placeholderEmail(phone, domain) {
  const digits = String(phone).replace(/\D/g, "");
  return `wa${digits || "unknown"}@${domain}`;
}

function parseMetadata(m) {
  if (typeof m !== "string") return m ?? {};
  try {
    return JSON.parse(m);
  } catch {
    return {};
  }
}

export function buildMcpServer({ paystack, placeholderEmailDomain = "example.com", now = () => new Date() }) {
  const server = new McpServer({ name: "mama-t-orders", version: "1.0.0" });

  server.registerTool(
    "get_menu",
    {
      title: "Get menu, delivery zones and ordering rules",
      description:
        "Returns Mama T's current menu with prices, delivery zones with fees, and ordering rules (minimum order, notice period, closed days). " +
        "Call this before quoting any price or zone. Never quote prices from memory.",
      inputSchema: {},
    },
    async () => {
      log({ tool: "get_menu" });
      return json({
        business: BUSINESS,
        today_in_lagos: new Date(now().getTime() + 36e5).toISOString().slice(0, 10),
        menu: MENU.map((m) => ({ ...m, price: formatNaira(m.price_kobo) })),
        delivery_zones: DELIVERY_ZONES.map((z) => ({ ...z, fee: formatNaira(z.fee_kobo) })),
        rules: {
          minimum_order: formatNaira(RULES.minimum_order_kobo) + " before delivery",
          max_quantity_per_item: RULES.max_quantity_per_item,
          closed: "Sundays",
          max_days_ahead: RULES.max_days_ahead,
          notice: "Most items need 24 hours' notice before the 10:00 delivery slot; the Party Tray needs 48 hours.",
        },
      });
    },
  );

  server.registerTool(
    "quote_order",
    {
      title: "Price and validate an order",
      description:
        "Validates an order (items, zone, date) and returns the exact total. Does not charge anything. " +
        "If ok is false, explain each item in `problems` to the customer and ask them to adjust. " +
        "Show the `summary` to the customer and get a clear yes before calling create_payment_link.",
      inputSchema: orderShape,
    },
    async (args) => {
      const quote = quoteOrder(args, now());
      log({ tool: "quote_order", ok: quote.ok, total_kobo: quote.total_kobo });
      return json(quote);
    },
  );

  server.registerTool(
    "create_payment_link",
    {
      title: "Create the order and a Paystack payment link",
      description:
        "Creates the order and a Paystack checkout link for the exact quoted total. Only call after the customer has confirmed the quote " +
        "and given their name, phone number and delivery address (address not needed for pickup). " +
        "Send the returned payment_url and order_reference to the customer. The order is NOT confirmed until check_payment returns PAID.",
      inputSchema: {
        ...orderShape,
        customer_name: z.string().min(1).describe("Customer's name"),
        customer_phone: z.string().min(7).describe("Customer's WhatsApp phone number"),
        delivery_address: z.string().optional().describe("Full delivery address; omit for pickup"),
        customer_email: z.string().email().optional().describe("Customer email for the receipt, if they offered one"),
        notes: z.string().max(300).optional().describe("Special instructions, e.g. 'less pepper'"),
      },
    },
    async (args) => {
      const quote = quoteOrder(args, now());
      if (!quote.ok) {
        log({ tool: "create_payment_link", ok: false, reason: "invalid_order" });
        return json({ status: "INVALID_ORDER", problems: quote.problems, agent_guidance: "Fix these with the customer, then quote again." });
      }
      if (quote.delivery_zone !== "pickup" && !args.delivery_address?.trim()) {
        return json({ status: "MISSING_ADDRESS", agent_guidance: "Ask the customer for their full delivery address, then call this tool again." });
      }

      const reference = newOrderReference(now());
      const order = {
        order_reference: reference,
        customer_name: args.customer_name,
        customer_phone: args.customer_phone,
        delivery_zone: quote.delivery_zone,
        delivery_date: quote.delivery_date,
        delivery_address: args.delivery_address ?? "PICKUP",
        notes: args.notes ?? "",
        lines: quote.lines.map(({ item_id, quantity, line_total_kobo }) => ({ item_id, quantity, line_total_kobo })),
        expected_amount_kobo: quote.total_kobo,
      };

      try {
        const data = await paystack.initialize({
          // Paystack requires an email; most WhatsApp customers never give one.
          email: args.customer_email ?? placeholderEmail(args.customer_phone, placeholderEmailDomain),
          amountKobo: quote.total_kobo,
          reference,
          metadata: {
            ...order,
            custom_fields: [
              { display_name: "Order", variable_name: "order_reference", value: reference },
              { display_name: "Delivery date", variable_name: "delivery_date", value: quote.delivery_date },
              { display_name: "Customer phone", variable_name: "customer_phone", value: args.customer_phone },
            ],
          },
        });
        log({ tool: "create_payment_link", ok: true, reference, total_kobo: quote.total_kobo, mode: paystack.mode });
        return json({
          status: "AWAITING_PAYMENT",
          order_reference: reference,
          payment_url: data.authorization_url,
          amount: formatNaira(quote.total_kobo),
          summary: quote.summary,
          agent_guidance:
            "Send the payment_url and order_reference to the customer. Ask them to reply once they've paid, then call check_payment. " +
            "Do not accept screenshots or transfer receipts as proof of payment.",
        });
      } catch (err) {
        log({ tool: "create_payment_link", ok: false, reference, error: err.message, kind: err.kind });
        return toolError(err instanceof PaystackError ? err : new PaystackError(err.message, { kind: "internal" }));
      }
    },
  );

  server.registerTool(
    "check_payment",
    {
      title: "Check whether an order has been paid",
      description:
        "Asks Paystack directly whether the order's payment went through. Call when the customer says they've paid, " +
        "sends a screenshot, or asks about an existing order. This is the only valid proof of payment.",
      inputSchema: {
        order_reference: z.string().describe("Order reference, e.g. MT-20261020-AB12CD"),
      },
    },
    async ({ order_reference }) => {
      const reference = order_reference.trim().toUpperCase();
      try {
        const t = await paystack.verify(reference);
        const meta = parseMetadata(t.metadata);
        const expected = Number(meta.expected_amount_kobo);
        let result;

        if (t.status === "success") {
          if (t.currency !== "NGN" || (Number.isFinite(expected) && t.amount !== expected)) {
            result = {
              status: "AMOUNT_MISMATCH",
              agent_guidance: "Payment amount doesn't match the order. Do not confirm. Tell the customer a person will check it shortly and escalate to a human.",
            };
          } else {
            result = {
              status: "PAID",
              amount_paid: formatNaira(t.amount),
              paid_at: t.paid_at,
              order: {
                delivery_date: meta.delivery_date,
                delivery_zone: meta.delivery_zone,
                delivery_address: meta.delivery_address,
                lines: meta.lines,
              },
              agent_guidance: "Confirm the order to the customer: reference, items, delivery date and address. Thank them warmly.",
            };
          }
        } else if (t.status === "failed") {
          result = {
            status: "FAILED",
            gateway_response: t.gateway_response,
            agent_guidance:
              "The payment was declined. Tell the customer kindly, without blaming them. They can retry on the same link, or you can create a new link. The order is not confirmed.",
          };
        } else if (t.status === "reversed") {
          result = { status: "REVERSED", agent_guidance: "The payment was reversed. Do not confirm. Escalate to a human." };
        } else {
          // abandoned / ongoing / pending / queued / processing: money hasn't arrived yet.
          result = {
            status: "NOT_PAID_YET",
            paystack_status: t.status,
            agent_guidance:
              "Paystack has not received this payment yet. Ask the customer to finish checkout on the payment link, then tell you again. Do not confirm the order.",
          };
        }
        log({ tool: "check_payment", reference, paystack_status: t.status, result: result.status });
        return json({ order_reference: reference, ...result });
      } catch (err) {
        if (err.kind === "not_found") {
          log({ tool: "check_payment", reference, result: "NOT_FOUND" });
          return json({
            order_reference: reference,
            status: "NOT_FOUND",
            agent_guidance: "No order with that reference. Ask the customer to double-check it (format MT-YYYYMMDD-XXXXXX), or offer to start a new order.",
          });
        }
        log({ tool: "check_payment", reference, ok: false, error: err.message, kind: err.kind });
        return toolError(err);
      }
    },
  );

  return server;
}
