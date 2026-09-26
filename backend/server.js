const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { z } = require('zod');

// This server is deliberately a safe integration scaffold. It does not accept
// card details, mark payments as successful, or move money. Connect a licensed
// provider's hosted checkout and verify its signed webhook before granting access.
dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5500';

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: allowedOrigin, methods: ['GET', 'POST'] }));
app.use(express.json({ limit: '20kb' }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: true }));

const plans = Object.freeze({
  starter: { name: 'Starter Plan', amount: 20, currency: 'GHS' },
  pro: { name: 'Pro Plan', amount: 50, currency: 'GHS' },
  vip: { name: 'VIP Plan', amount: 100, currency: 'GHS' },
  elite: { name: 'Elite Plan', amount: 200, currency: 'GHS' }
});

const checkoutSchema = z.object({
  planId: z.enum(['starter', 'pro', 'vip', 'elite']),
  email: z.string().email().max(254),
  fullName: z.string().trim().min(2).max(100)
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'sports-predictor-backend', environment: process.env.NODE_ENV || 'development' });
});

app.get('/api/plans', (_req, res) => {
  res.json({ plans });
});

app.post('/api/checkout/session', (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid checkout details', details: parsed.error.flatten().fieldErrors });
  }

  const plan = plans[parsed.data.planId];
  if (process.env.PAYMENT_PROVIDER !== 'sandbox') {
    // Implement this branch only with the official SDK for a licensed provider.
    // Create a hosted checkout session using the provider's server-side secret,
    // then return its URL. Never collect payment credentials in this API.
    return res.status(501).json({ error: 'Payment provider integration is not configured.' });
  }

  // Sandbox response is explicit so nobody mistakes it for a real payment.
  return res.status(200).json({
    mode: 'sandbox',
    message: 'Sandbox checkout only. No payment was collected.',
    plan,
    checkoutUrl: null
  });
});

// In production, verify the provider signature against the raw request body,
// check the event idempotency key, and then grant access after payment success.
app.post('/api/payments/webhook', (req, res) => {
  if (process.env.PAYMENT_PROVIDER === 'sandbox') {
    return res.status(200).json({ received: true, mode: 'sandbox' });
  }
  return res.status(501).json({ error: 'Webhook verification is not configured.' });
});

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
