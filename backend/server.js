const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_4eC39HqLyjWDarhtT657tSR');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3001);
const clientOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5500';

// In-memory database (use PostgreSQL + Prisma in production)
const db = {
  users: new Map(),
  subscriptions: new Map(),
  payments: new Map(),
  reports: new Map()
};

// Middleware
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: clientOrigin, credentials: true }));
app.use(express.json({ limit: '10kb' }));

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5 });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 });
app.use('/api/', apiLimiter);

// Validation schemas
const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(100)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const checkoutSchema = z.object({
  planId: z.enum(['starter', 'pro', 'analyst', 'vip']),
  email: z.string().email().max(254),
  fullName: z.string().min(2).max(100)
});

// Plans
const plans = {
  starter: { id: 'starter', name: 'Starter', amount: 1200, stripePriceId: 'price_starter', features: ['5 reports/month', 'Weekly digest', 'Community access'] },
  pro: { id: 'pro', name: 'Pro', amount: 2900, stripePriceId: 'price_pro', features: ['30 reports/month', 'Tactical breakdowns', 'Priority support'] },
  analyst: { id: 'analyst', name: 'Analyst', amount: 4900, stripePriceId: 'price_analyst', features: ['Unlimited reports', 'Advanced xG models', 'Video notes'] },
  vip: { id: 'vip', name: 'VIP', amount: 9900, stripePriceId: 'price_vip', features: ['Everything in Analyst', 'Strategy sessions', 'Direct support'] }
};

// Reports library
const reports = [
  { id: '1', title: 'Premier League xG Analysis', plan: 'starter', description: 'Expected goals breakdown', date: new Date() },
  { id: '2', title: 'Tactical Trends Report', plan: 'pro', description: 'Weekly tactical patterns', date: new Date(Date.now() - 86400000) },
  { id: '3', title: 'Advanced Model Insights', plan: 'analyst', description: 'Deep xG and press models', date: new Date(Date.now() - 172800000) },
  { id: '4', title: 'VIP Strategy Session', plan: 'vip', description: 'Private member analysis', date: new Date(Date.now() - 259200000) }
];

reports.forEach(r => db.reports.set(r.id, r));

// Helpers
function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'dev-secret-key', { expiresIn: '7d' });
}

function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key');
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Routes: Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'sportiq-backend', environment: process.env.NODE_ENV || 'development' });
});

// Routes: Auth - Register
app.post('/api/auth/register', authLimiter, (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { email, password, name } = parsed.data;
  if (Array.from(db.users.values()).find(u => u.email === email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const userId = uuidv4();
  const user = {
    id: userId,
    email,
    name,
    passwordHash: hashPassword(password),
    subscriptionId: null,
    createdAt: new Date()
  };
  db.users.set(userId, user);

  const token = generateToken(userId);
  res.status(201).json({ token, user: { id: user.id, email, name } });
});

// Routes: Auth - Login
app.post('/api/auth/login', authLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid credentials' });

  const { email, password } = parsed.data;
  const user = Array.from(db.users.values()).find(u => u.email === email);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = generateToken(user.id);
  const subscription = user.subscriptionId ? db.subscriptions.get(user.subscriptionId) : null;

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
    subscription: subscription ? { plan: subscription.planId, status: subscription.status, expiresAt: subscription.expiresAt } : null
  });
});

// Routes: Plans
app.get('/api/plans', (_req, res) => {
  res.json({ plans: Object.values(plans) });
});

// Routes: Checkout - Create Stripe session
app.post('/api/checkout/session', (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const { planId, email, fullName } = parsed.data;
  const plan = plans[planId];
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  // In test mode, return demo session
  if (process.env.STRIPE_MODE !== 'live') {
    return res.json({
      sessionId: `demo_${uuidv4()}`,
      checkoutUrl: `https://checkout.stripe.com/demo?plan=${planId}`,
      message: 'Demo mode: This is a test checkout. Use card 4242 4242 4242 4242 to test.'
    });
  }

  // Production: Create real Stripe session
  stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    mode: 'payment',
    success_url: `${clientOrigin}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${clientOrigin}/pricing`,
    customer_email: email,
    metadata: { planId, fullName }
  }, (err, session) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ sessionId: session.id, checkoutUrl: session.url });
  });
});

// Routes: Webhook - Stripe (handle payment success)
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ error: 'No signature' });

  // In production: verify signature
  // const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  
  // Demo mode: parse event directly
  let event;
  try {
    event = JSON.parse(req.body);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { planId, fullName } = session.metadata;
    const email = session.customer_email;

    // Find or create user
    let user = Array.from(db.users.values()).find(u => u.email === email);
    if (!user) {
      const userId = uuidv4();
      user = {
        id: userId,
        email,
        name: fullName,
        passwordHash: bcrypt.hashSync(uuidv4(), 10),
        subscriptionId: null,
        createdAt: new Date()
      };
      db.users.set(userId, user);
    }

    // Create subscription
    const subId = uuidv4();
    const subscription = {
      id: subId,
      userId: user.id,
      planId,
      status: 'active',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      paymentId: session.payment_intent
    };
    db.subscriptions.set(subId, subscription);
    user.subscriptionId = subId;
    db.users.set(user.id, user);

    console.log(`✅ Subscription activated: ${email} on ${planId}`);
  }

  res.json({ received: true });
});

// Routes: Protected - User profile
app.get('/api/user/profile', verifyToken, (req, res) => {
  const user = db.users.get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const subscription = user.subscriptionId ? db.subscriptions.get(user.subscriptionId) : null;

  res.json({
    user: { id: user.id, email: user.email, name: user.name },
    subscription: subscription ? {
      plan: subscription.planId,
      status: subscription.status,
      expiresAt: subscription.expiresAt,
      planDetails: plans[subscription.planId]
    } : null
  });
});

// Routes: Protected - Get available reports for user's plan
app.get('/api/reports', verifyToken, (req, res) => {
  const user = db.users.get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const subscription = user.subscriptionId ? db.subscriptions.get(user.subscriptionId) : null;
  if (!subscription || subscription.status !== 'active') {
    return res.json({ reports: [], message: 'No active subscription' });
  }

  // Return reports accessible to user's plan
  const planHierarchy = { starter: 1, pro: 2, analyst: 3, vip: 4 };
  const userLevel = planHierarchy[subscription.planId] || 0;

  const accessibleReports = Array.from(db.reports.values()).filter(r => {
    return planHierarchy[r.plan] <= userLevel;
  });

  res.json({ reports: accessibleReports });
});

// Routes: Protected - Cancel subscription
app.post('/api/user/subscription/cancel', verifyToken, (req, res) => {
  const user = db.users.get(req.userId);
  if (!user || !user.subscriptionId) return res.status(404).json({ error: 'No subscription' });

  const subscription = db.subscriptions.get(user.subscriptionId);
  subscription.status = 'cancelled';
  user.subscriptionId = null;

  res.json({ message: 'Subscription cancelled' });
});

// Error handling
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res) => {
  console.error(err);
  res.status(500).json({ error: 'Internal error' });
});

app.listen(port, () => {
  console.log(`\n🚀 SportIQ Backend`);
  console.log(`📍 http://localhost:${port}`);
  console.log(`💳 Stripe: ${process.env.STRIPE_MODE || 'test mode'}`);
  console.log(`✅ Health: GET /api/health\n`);
});
