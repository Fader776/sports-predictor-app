const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const allowedOrigin = process.env.CLIENT_ORIGIN || 'http://localhost:5500';

// Middleware
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: allowedOrigin, methods: ['GET', 'POST', 'PUT'], credentials: true }));
app.use(express.json({ limit: '20kb' }));

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  message: 'Too many login attempts, please try again later.'
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true
});

app.use('/api/', apiLimiter);

// Plans configuration
const plans = {
  starter: { name: 'Starter Plan', amount: 20, currency: 'GHS', features: ['2 premium tips', 'Daily analysis', 'Email support'] },
  pro: { name: 'Pro Plan', amount: 50, currency: 'GHS', features: ['8 premium tips', 'Hot alerts', 'Priority support', 'Team analysis'] },
  vip: { name: 'VIP Plan', amount: 100, currency: 'GHS', features: ['20+ tips', 'VIP group', 'Advanced strategy', 'Live updates'] },
  elite: { name: 'Elite Plan', amount: 200, currency: 'GHS', features: ['Unlimited access', 'Private calls', 'Weekly strategy', 'Dedicated consultant'] }
};

// Validation schemas
const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  name: z.string().min(2).max(100)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

const checkoutSchema = z.object({
  planId: z.enum(['starter', 'pro', 'vip', 'elite']),
  email: z.string().email().max(254),
  fullName: z.string().trim().min(2).max(100)
});

// Helper: Generate JWT
function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

// Middleware: Verify JWT
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Routes: Health & Status
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'stickers-predictor-backend', version: '1.0.0', environment: process.env.NODE_ENV || 'development' });
});

// Routes: Plans
app.get('/api/plans', (_req, res) => {
  res.json({ plans });
});

// Routes: Auth - Register
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
  }

  const { email, password, name } = parsed.data;

  // TODO: Check if user exists in DB
  // TODO: Hash password with bcrypt
  // TODO: Store user in database
  // TODO: Send verification email

  // Placeholder response
  res.status(201).json({
    message: 'User created successfully. Please verify your email.',
    userId: uuidv4(),
    email
  });
});

// Routes: Auth - Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid credentials' });
  }

  const { email, password } = parsed.data;

  // TODO: Find user by email in database
  // TODO: Compare password hash
  // TODO: Update last login
  // TODO: Generate session

  // Placeholder response
  res.json({
    token: generateToken(uuidv4()),
    user: { email, name: 'User' },
    message: 'Logged in successfully'
  });
});

// Routes: Checkout
app.post('/api/checkout/session', async (req, res) => {
  const parsed = checkoutSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid checkout details', details: parsed.error.flatten().fieldErrors });
  }

  const { planId, email, fullName } = parsed.data;
  const plan = plans[planId];

  if (!plan) {
    return res.status(404).json({ error: 'Plan not found' });
  }

  // TODO: Create order in database with status 'pending'
  // TODO: If Stripe enabled, create Stripe checkout session
  // TODO: Return checkout URL or Stripe session ID

  // Placeholder response
  res.json({
    orderId: uuidv4(),
    plan,
    status: 'pending',
    message: 'Checkout session created. In production, redirect to Stripe hosted checkout.',
    stripeSessionUrl: null // Will be populated with Stripe session URL in production
  });
});

// Routes: Webhook - Stripe
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature'];

  // TODO: Verify Stripe webhook signature
  // TODO: Handle event types: checkout.session.completed, charge.failed, etc.
  // TODO: Update order status in database
  // TODO: Create subscription if successful
  // TODO: Send confirmation email

  // Placeholder response
  res.json({ received: true, message: 'Webhook signature verification not yet configured' });
});

// Routes: Protected - Get user subscription
app.get('/api/user/subscription', verifyToken, (req, res) => {
  // TODO: Fetch user subscription from database
  res.json({ message: 'User subscription endpoint', userId: req.userId });
});

// Routes: Protected - Cancel subscription
app.post('/api/user/subscription/cancel', verifyToken, (req, res) => {
  // TODO: Cancel Stripe subscription
  // TODO: Update database
  // TODO: Send cancellation email
  res.json({ message: 'Subscription cancelled' });
});

// Error handling
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`🚀 Backend listening on http://localhost:${port}`);
  console.log(`📧 Mailer: ${process.env.FEATURE_EMAIL_ENABLED ? 'Enabled' : 'Disabled'}`);
  console.log(`💳 Stripe: ${process.env.FEATURE_STRIPE_ENABLED ? 'Enabled' : 'Disabled'}`);
});
