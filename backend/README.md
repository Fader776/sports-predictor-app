# Backend setup

This directory contains a **sandbox-only** Express API scaffold. It intentionally does not collect card numbers, claim that a payment succeeded, or grant paid access without a verified provider webhook.

## Run locally

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Check `http://localhost:3000/api/health`.

## Production payment checklist

Before accepting money or selling prediction services, obtain the required business/gambling approvals for each target jurisdiction and use a payment provider that explicitly permits the business model. Then:

1. Use the provider's official hosted checkout or SDK.
2. Keep API keys in deployment secrets, never in browser code or Git.
3. Verify signed webhooks using the raw request body.
4. Make webhook processing idempotent and grant access only after a verified success event.
5. Add customer receipts, refunds, terms, privacy, age/location controls, and responsible-play information where applicable.
6. Store only the minimum customer data needed and use HTTPS in production.

The current `PAYMENT_PROVIDER=sandbox` mode is the only configured mode and never charges a customer.
