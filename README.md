# PartPulse — Parts Marketplace Demo

**PartPulse** is a full-featured auto-parts marketplace demo built as a mobile-first web app. It connects **buyers** who need a part with **verified suppliers** who sell it — powered by an AI assistant that understands plain-language requests, an AI diagnostics mechanic, and a Pro subscription layer that unlocks the advanced tools on both sides.

Built on the TanStack Start + React stack and deployed as a Cloudflare Worker.

---

## ✨ What's inside

### 🛒 Buyer experience
- **AI RFQ chat** — describe a part in plain English (e.g. *"Brake pads for a 2019 Toyota Camry"*). The assistant parses the vehicle + part, checks live supplier pricing, and posts a request for quote (RFQ).
- **Guided details flow** — the AI asks for the right details (name, email, VIN, quantity, condition, delivery location, preferred brand) so suppliers can match accurately.
- **Live bids** — verified suppliers respond in real time with price, brand and ETA; you can negotiate, compare and accept the best deal.
- **Secure settlement** — accept a bid and the marketplace fee is split out (7%), with the payout to the supplier recorded.
- **Free tier** — a limited number of RFQs before the upgrade path kicks in.

### 👑 Buyer Pro (AED 99/mo)
- **24-hour retention & save chats forever** — your requests and conversations never expire.
- **My Garage** — save all your vehicles and re-order parts in one tap.
- **AI Diagnostics** — describe a symptom (squealing brakes, battery dying, check-engine light…) and get likely causes with confidence scores. It explains **how to fix the problem first**, and only quotes parts when you ask.
- **Unlimited RFQs** — post as many requests as you need.
- **Priority suppliers** — verified suppliers answer you first.
- **Smart price alerts** — set a target price on any part and get pinged the moment it drops.

### 🏪 Supplier experience
- **AI onboarding** — photograph your business card and the AI reads your business name, brand specialities and categories automatically.
- **Inbound request feed** — see live buyer RFQs with budgets, searchable and with match highlighting.
- **Bidding** — place bids with brand, price and ETA; boost bids for priority placement.
- **Verification** — upload your trade license to earn the green "Verified" badge.
- **Earnings & payouts** — track your payout total, deal count and pending settlement.
- **Pro upsell** — unlimited RFQs, priority feed placement and win-rate analytics.
- **Stock AI (CSV import)** — import and manage your stock from a CSV, with the AI quoting at your target margin.

### ⚙️ Platform-wide
- **Phone + OTP login** with a role selector (Buyer / Supplier).
- **Toast notifications** for every key action (deal confirmed, bid sent, verified, Pro unlocked, price-alert hits).
- **Pricing modal** explaining exactly how PartPulse makes money.
- **Seed demo data** that makes every screen work out of the box, plus a live Cloudflare D1 database for real RFQs, bids and payouts.

---

## 🧱 Tech stack

- **Framework:** TanStack Start (SSR) + React 19 + TanStack Router
- **Styling:** Tailwind CSS v4 + shadcn/ui-style components
- **Data layer:** Drizzle ORM over Cloudflare D1 (Postgres-compatible driver)
- **Payments:** Stripe (Checkout for Pro subscriptions, with a local fallback when no keys are set)
- **AI/server:** Cloudflare Workers (V8-compatible only — no native Node addons)
- **Language:** TypeScript (strict)

---

## 🚀 Getting started

### Prerequisites
- Node.js 20+ and `pnpm` (10.x)

### Install & run
```bash
pnpm install
pnpm dev
```

The dev server runs on port **13000**. Open `http://localhost:13000`.

### Verify the whole project
```bash
pnpm verify
```
This runs linting, type checking, a production build, and a smoke check against the running dev server.

---

## 🧪 Demo mode

The demo ships with realistic seed data so every screen works immediately:

- **Buyers** get the chat, AI parsing, live bids, diagnostics and garage populated.
- **Suppliers** get an AI business-card onboarding flow, a live request feed and earnings.
- **Pro** features are client-side demo flows; upgrading runs through real Stripe Checkout when keys are configured, and falls back gracefully to a local success path otherwise.

> Note: RFQ retention and "save forever" are product-copy promises in the demo, not enforced timers. CSV stock import runs entirely in the browser.

---

## 📁 Project structure

```
src/
├── routes/               # TanStack Router pages (index/root shell, app frame)
├── components/           # BuyerApp, SupplierApp, StockTab, PricingModal
├── lib/
│   ├── store.tsx         # Global app state + context (buyer, supplier, toasts)
│   ├── backend.functions.ts / backend.server.ts   # API + Cloudflare functions
│   ├── api.types.ts      # Shared API types
│   ├── ai.server.ts      # AI/server helpers
│   └── stripe.server.ts  # Stripe Checkout setup
├── db/schema/            # Drizzle schema for Cloudflare D1
└── styles.css            # Global theme + design tokens
```

## 🔐 Environment variables

Copy `.env.example` to `.env` and fill in what you need. Keys are never committed or logged.

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe server key for Checkout (optional — demo falls back) |
| `DATABASE_URL` | Connection for the Cloudflare D1 database |

---

## 🧑‍💻 Developer

Developed by **Aymen Rouagha**.

---

## 📄 Attribution

Based on the TanStack Start vibe-coding template.
Create with HappySeeds: https://happyseeds.ai
