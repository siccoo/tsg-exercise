# 3-minute recording script

Screen layout: WhatsApp simulator on the left, Vercel logs (or Paystack test
dashboard) on the right. Use a fresh conversation.

**0:00–0:20: The problem (talk over the simulator).**
"Mama T runs a small-chops kitchen on WhatsApp. She spends her evenings quoting
prices and checking transfer screenshots, and she's been burned by fake alerts.
This agent takes the order and only confirms when Paystack says the money is in."

**0:20–1:10: Order and quote.**
- Customer: *Hi, I need small chops for about 15 people this Saturday, delivered to Yaba*
- Agent suggests the 50-piece tray, quotes from `get_menu` / `quote_order`.
- Customer: *Add 2 Chapman. Make it less pepper.*
- Agent sends the updated summary with the total. Point at the log lines:
  "Prices come from code, not from the model."

**1:10–1:40: Details and payment link.**
- Customer: *Yes go ahead. Tolu Bakare, 0800 000 0001, 5 Fake Street, Yaba*
- Agent calls `create_payment_link` and sends the link + `MT-...` reference.
- Optional: show the transaction appearing as "abandoned" in Paystack.

**1:40–2:10: The fake alert moment (the key beat).**
- Before paying, customer: *I've sent it* (attach any screenshot or just say it).
- Agent calls `check_payment` → `NOT_PAID_YET`, politely refuses to confirm.
  "This is the screenshot problem. The agent asks Paystack, not the customer."

**2:10–2:45: Pay and confirm.**
- Open the link, pay with test card `4084 0840 8408 4081`, PIN `0000`, OTP `123456`.
- Customer: *Done now*
- Agent calls `check_payment` → `PAID`, confirms with reference, items, date, address.
- Show the paid transaction in the Paystack dashboard with the order metadata.

**2:45–3:00: Wrap.**
"Declines, wrong amounts, Paystack outages and big orders all have their own
paths. They're in the README and field notes. Thanks!"

Tips: rehearse once (each run costs credits), and keep the date a real
Monday–Saturday at least 2 days out so the notice rule doesn't derail the take.
