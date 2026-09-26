# STICKERS PREDICTOR

A responsive sports-information subscription website prototype. It presents match analysis and paid plan concepts without promising winnings or guaranteed outcomes.

## Current status

- The frontend is a static prototype.
- The backend is a sandbox-only Express API.
- Checkout does **not** collect money and does not report a payment as successful.
- A licensed payment provider must be configured before accepting any payment.

## Run locally

### Frontend

Open `index.html` in a browser. If the API is running on another origin, set this before loading the page:

```html
<script>window.STICKERS_API_BASE = 'http://localhost:3000';</script>
```

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

The API health endpoint is `http://localhost:3000/api/health`.

## Before production

Obtain the required business, consumer-protection, advertising, and—where applicable—sports wagering approvals for every target jurisdiction. Confirm that the chosen payment provider permits the exact business model.

Then add:

1. A provider-hosted checkout created server-side.
2. Secret management and HTTPS.
3. Signed, idempotent webhook verification.
4. Receipts, refunds, support contact, terms, privacy, and age/location controls where applicable.
5. Evidence-based historical performance reporting; never publish fabricated win rates, live/API claims, or testimonials.
6. A real match-data provider with attribution, caching, error handling, and timestamps.

Never collect card numbers in this static page, expose provider secrets, or tell a customer that payment succeeded until the provider's verified webhook confirms it.
