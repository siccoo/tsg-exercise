# Go-live note for Mama T

**What Tobi does.** Tobi answers your WhatsApp orders day and night. It tells
customers what's on the menu and what it costs, checks your rules (24 hours'
notice, 48 for the Party Tray, no Sundays, ₦10,000 minimum), and sends a
Paystack payment link. It confirms an order **only when Paystack says the money
has arrived**. Screenshots and "I've sent it" don't count, so fake alerts can't
get food out of your kitchen.

**What Tobi doesn't do.** It can't give discounts, change or cancel a paid order,
issue refunds, take cakes or custom catering, or deliver outside Lagos. In all
those cases it tells the customer a person will reply and hands the chat to you.
It doesn't schedule Dayo's deliveries. Today you see paid orders in the Paystack
dashboard, not on a kitchen list.

**Before real customers use it:**

1. **Paystack live keys.** Your Paystack business must be verified (CAC
   documents, bank account). Then we swap the test key for the live one. Until
   then no real money can move.
2. **Your WhatsApp number.** Connect the shop's WhatsApp Business number to
   Chord. Decide whether you still reply from your phone (Tobi steps back when
   you take over a chat).
3. **Who gets alerted.** When Tobi hands a chat over, or the payment system is
   down, someone must get a ping within 15 minutes during opening hours. We'd
   set that to your phone and Dayo's.
4. **Check the menu.** Prices, zones and fees live in one file. Every price
   change needs a quick update from us until we move them to a Google Sheet you
   can edit.
5. **A daily order list.** Add a 7 p.m. message to you listing tomorrow's paid
   orders, so nothing paid is missed in the kitchen.
6. **One week of shadowing.** Read every conversation for the first week and
   correct anything Tobi gets wrong.

**When a payment fails.** The customer is told kindly, nothing is charged, and
they can retry on the same link. The order is never confirmed. If Paystack
itself is down, Tobi apologises and hands the chat to you.
