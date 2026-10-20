// Single source of truth for what Mama T's sells and what it costs.
// The agent never quotes prices from memory: it reads them through get_menu
// and every total is recomputed here before a payment link is created.
// All money is integer kobo (₦1 = 100 kobo), which is also what Paystack expects.

export const BUSINESS = {
  name: "Mama T's Small Chops",
  city: "Lagos",
  pickup_address: "12 Demo Close, Ikeja GRA, Lagos (fictional)",
  timezone: "Africa/Lagos",
  delivery_hours: "10:00-18:00, Monday to Saturday",
};

export const MENU = [
  {
    id: "tray-25",
    name: "Small Chops Tray (25 pieces)",
    description: "Puff-puff, samosa, spring rolls and peppered chicken wings. Feeds 5-8.",
    price_kobo: 1_500_000,
    lead_time_hours: 24,
  },
  {
    id: "tray-50",
    name: "Small Chops Tray (50 pieces)",
    description: "Same mix as the 25-piece tray. Feeds 10-15.",
    price_kobo: 2_800_000,
    lead_time_hours: 24,
  },
  {
    id: "tray-100",
    name: "Party Tray (100 pieces)",
    description: "Full party mix plus mosa and gizzard skewers. Feeds 25-30.",
    price_kobo: 5_200_000,
    lead_time_hours: 48,
  },
  {
    id: "gizzard-1l",
    name: "Peppered Gizzard (1 litre bowl)",
    description: "Spicy fried gizzard in pepper sauce.",
    price_kobo: 950_000,
    lead_time_hours: 24,
  },
  {
    id: "asun-1l",
    name: "Asun (1 litre bowl)",
    description: "Spicy grilled goat meat.",
    price_kobo: 1_200_000,
    lead_time_hours: 24,
  },
  {
    id: "chapman-1.5l",
    name: "Chapman (1.5 litre bottle)",
    description: "House Chapman, chilled.",
    price_kobo: 450_000,
    lead_time_hours: 24,
  },
];

export const DELIVERY_ZONES = [
  { id: "pickup", name: "Pickup at Ikeja GRA", areas: ["Pickup"], fee_kobo: 0 },
  { id: "mainland-near", name: "Mainland (near)", areas: ["Ikeja", "Maryland", "Ogba", "Ojodu", "Allen"], fee_kobo: 250_000 },
  { id: "mainland-far", name: "Mainland (far)", areas: ["Yaba", "Surulere", "Gbagada", "Ketu", "Magodo", "Festac"], fee_kobo: 400_000 },
  { id: "island", name: "Island", areas: ["Victoria Island", "Ikoyi", "Lekki Phase 1", "Oniru"], fee_kobo: 650_000 },
  { id: "island-far", name: "Island (far)", areas: ["Ajah", "Chevron", "Sangotedo", "Lekki (beyond Phase 1)"], fee_kobo: 800_000 },
];

export const RULES = {
  minimum_order_kobo: 1_000_000, // ₦10,000 before delivery
  max_quantity_per_item: 20, // bigger orders go to Mama T herself
  closed_weekdays: [0], // Sunday (0 = Sunday in JS)
  max_days_ahead: 60,
};

export const formatNaira = (kobo) =>
  "₦" + (kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const findItem = (id) => MENU.find((m) => m.id === id);
export const findZone = (id) => DELIVERY_ZONES.find((z) => z.id === id);
