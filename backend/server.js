const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY || 'sk_test_demo');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5500';

// In-memory storage (replace with Prisma/PostgreSQL in production)
const db = {
  users: new Map(),
  orders: new Map(),
  subscriptions: new Map(),
  emailLogs: new Map()
};

// Middleware
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: allowedOrigin, methods: ['GET', 'POST', 'PUT'], credentials: true }));
app.use(express.json({ limit: '20kb' }));

// Rate limiting
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, message: 'Too many attempts' });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 });
app.use('/api/', apiLimiter);

// Plans
const plans = {
  starter: { id: 'starter', name: 'Starter Plan', amount: 20, currency: 'GHS', features: ['2 daily tips', 'Email support', '7-day access'], stripePriceId: 'price_starter' },
  pro: { id: 'pro', name: 'Pro Plan', amount: 50, currency: 'GHS', features: ['8 daily tips', 'Priority support', 'Analysis reports', '30-day access'], stripePriceId: 'price_pro' },
  vip: { id: 'vip', name: 'VIP Plan', amount: 100, currency: 'GHS', features: ['20+ daily tips', 'Live alerts', 'Advanced strategy', '90-day access', 'VIP group'], stripePriceId: 'price_vip' },
  elite: { id: 'elite', name: 'Elite Plan', amount: 200, currency: 'GHS', features: ['Unlimited tips', 'Private calls', 'Dedicated manager', '1-year access', 'Custom strategy'], stripePriceId: 'price_elite' }
};

// Schemas
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
  planId: z.enum(['starter', 'pro', 'vip', 'elite']),
  email: z.string().email().max(254),
  fullName: z.string().trim().min(2).max(100)
});

// Helpers
function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '7d' });
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    req.userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function sendEmail(to, subject, message, type = 'transactional') {
  const emailLog = { id: uuidv4(), to, subject, type, status: 'sent', createdAt: new Date() };
  db.emailLogs.set(emailLog.id, emailLog);
  console.log(`📧 Email sent to ${to}: ${subject}`);
  return emailLog;
}

// Routes: Health
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'stickers-predictor-backend', environment: process.env.NODE_ENV || 'development' });
});

// Routes: Plans
app.get('/api/plans', (_req, res) => {
  res.json({ plans: Object.values(plans) });
});

// Routes: Auth - Register
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

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
    isEmailVerified: false,
    isActive: true,
    subscriptionId: null,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  db.users.set(userId, user);

  await sendEmail(email, 'Welcome to Stickers Predictor', `Hi ${name}, verify your email to get started.`, 'welcome');

  res.status(201).json({
    message: 'Account created successfully. Check your email.',
    userId,
    email
  });
});

// Routes: Auth - Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid credentials' });

  const { email, password } = parsed.data;
  const user = Array.from(db.users.values()).find(u => u.email === email);

  if (!user || !verifyPassword(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  if (!user.isActive) {
    return res.status(403).json({ error: 'Account is inactive' });
  }

  const token = generateToken(user.id);
  const subscription = user.subscriptionId ? db.subscriptions.get(user.subscriptionId) : null;

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
    subscription: subscription ? { planId: subscription.planId, status: subscription.status, expiresAt: subscription.expiresAt } : null
  });
});

// Routes: Checkout
app.post('/api/checkout/session', async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });

  const { planId, email, fullName } = parsed.data;
  const plan = plans[planId];

  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  try {
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${allowedOrigin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${allowedOrigin}/cancel`,
      customer_email: email,
      metadata: { planId, fullName, email }
    });

    // Create pending order
    const orderId = uuidv4();
    const order = {
      id: orderId,
      email,
      fullName,
      planId,
      amount: plan.amount,
      currency: plan.currency,
      stripeSessionId: session.id,
      stripePaymentId: null,
      status: 'pending',
      paymentMethod: 'card',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    db.orders.set(orderId, order);

    res.json({
      orderId,
      plan,
      checkoutUrl: session.url,
      sessionId: session.id,
      status: 'pending'
    });
  } catch (error) {
    console.error('Stripe error:', error.message);
    res.status(500).json({ error: 'Could not create checkout session', message: error.message });
  }
});

// Routes: Webhook - Stripe
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test'
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { planId, fullName, email } = session.metadata;
      const plan = plans[planId];

      // Find or create user
      let user = Array.from(db.users.values()).find(u => u.email === email);
      if (!user) {
        const userId = uuidv4();
        user = {
          id: userId,
          email,
          name: fullName,
          passwordHash: null,
          isEmailVerified: true,
          isActive: true,
          subscriptionId: null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        db.users.set(userId, user);
      }

      // Create subscription
      const subscriptionId = uuidv4();
      const subscription = {
        id: subscriptionId,
        userId: user.id,
        planId,
        stripeSessionId: session.id,
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      db.subscriptions.set(subscriptionId, subscription);
      user.subscriptionId = subscriptionId;
      db.users.set(user.id, user);

      // Update order
      const order = Array.from(db.orders.values()).find(o => o.stripeSessionId === session.id);
      if (order) {
        order.status = 'completed';
        order.stripePaymentId = session.payment_intent;
        order.updatedAt = new Date();
        db.orders.set(order.id, order);
      }

      // Send confirmation email
      await sendEmail(
        email,
        `Welcome to ${plan.name}`,
        `Your subscription to ${plan.name} is now active. Enjoy ${plan.features.join(', ')}.`,
        'subscription_confirmed'
      );

      console.log(`✅ Subscription activated for ${email} on ${plan.name}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error.message);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// Routes: Protected - Get user profile
app.get('/api/user/profile', verifyToken, (req, res) => {
  const user = db.users.get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const subscription = user.subscriptionId ? db.subscriptions.get(user.subscriptionId) : null;
  const plan = subscription ? plans[subscription.planId] : null;

  res.json({
    user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
    subscription: subscription ? { id: subscription.id, plan: plan.name, status: subscription.status, expiresAt: subscription.currentPeriodEnd } : null
  });
});

// Routes: Protected - Get orders
app.get('/api/user/orders', verifyToken, (req, res) => {
  const orders = Array.from(db.orders.values()).filter(o => {
    const user = db.users.get(req.userId);
    return o.email === user.email;
  });

  res.json({ orders });
});

// Routes: Protected - Cancel subscription
app.post('/api/user/subscription/cancel', verifyToken, async (req, res) => {
  const user = db.users.get(req.userId);
  if (!user || !user.subscriptionId) return res.status(404).json({ error: 'No active subscription' });

  const subscription = db.subscriptions.get(user.subscriptionId);
  subscription.status = 'cancelled';
  subscription.updatedAt = new Date();
  db.subscriptions.set(subscription.id, subscription);
  user.subscriptionId = null;
  db.users.set(user.id, user);

  await sendEmail(user.email, 'Subscription Cancelled', 'Your subscription has been cancelled. You can resubscribe anytime.', 'subscription_cancelled');

  res.json({ message: 'Subscription cancelled successfully' });
});

// Routes: Admin - Get all orders
app.get('/api/admin/orders', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });

  const orders = Array.from(db.orders.values()).map(o => ({
    ...o,
    plan: plans[o.planId]
  }));

  res.json({ total: orders.length, orders });
});

// Routes: Admin - Get dashboard stats
app.get('/api/admin/stats', (req, res) => {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== process.env.ADMIN_KEY) return res.status(403).json({ error: 'Unauthorized' });

  const totalUsers = db.users.size;
  const activeSubscriptions = Array.from(db.subscriptions.values()).filter(s => s.status === 'active').length;
  const totalRevenue = Array.from(db.orders.values()).filter(o => o.status === 'completed').reduce((sum, o) => sum + o.amount, 0);
  const completedOrders = Array.from(db.orders.values()).filter(o => o.status === 'completed').length;

  res.json({ totalUsers, activeSubscriptions, totalRevenue, completedOrders });
});

// Error handling
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`\n🚀 Stickers Predictor Backend`);
  console.log(`📍 http://localhost:${port}`);
  console.log(`🔐 JWT: Enabled`);
  console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? 'Connected' : 'Demo mode'}`);
  console.log(`📧 Email: ${process.env.FEATURE_EMAIL_ENABLED ? 'Enabled' : 'Demo mode'}`);
  console.log(`\n✅ Health check: GET /api/health\n`);
});
