# Real Subscription Platform - Implementation Guide

## Overview

This is a production-ready subscription SaaS platform with:
- User authentication (register/login with JWT)
- Stripe payment integration
- Subscription management
- Email notifications
- Admin dashboard
- In-memory database (upgrade to PostgreSQL/Prisma for production)

## Quick Start

### Backend Setup

```bash
cd backend
cp .env.example .env

# Edit .env with your Stripe keys:
# STRIPE_SECRET_KEY=sk_test_...
# STRIPE_PUBLISHABLE_KEY=pk_test_...
# STRIPE_WEBHOOK_SECRET=whsec_...

npm install
npm run dev
```

API available at `http://localhost:3000`

### Frontend Setup

Open `index.html` in a browser (or use Live Server).

## API Endpoints

### Public
- `GET /api/health` - Server status
- `GET /api/plans` - Available subscription plans
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Login (returns JWT token)
- `POST /api/checkout/session` - Create Stripe checkout
- `POST /api/payments/webhook` - Stripe webhook (called by Stripe)

### Protected (require Bearer token)
- `GET /api/user/profile` - User info and subscription
- `GET /api/user/orders` - Payment history
- `POST /api/user/subscription/cancel` - Cancel subscription

### Admin (require X-Admin-Key header)
- `GET /api/admin/orders` - All orders
- `GET /api/admin/stats` - Dashboard statistics

## Payment Flow

1. **User selects plan** → Clicks "Choose Plan"
2. **Checkout modal opens** → Enter email and name
3. **Submit checkout** → `POST /api/checkout/session`
4. **Redirect to Stripe** → User enters card details on Stripe's hosted checkout
5. **Payment processed** → Stripe handles card security (PCI compliant)
6. **Webhook received** → `POST /api/payments/webhook` (Stripe → Backend)
7. **Subscription created** → User activated with access
8. **Confirmation email** → User receives order confirmation

## User Registration & Login

### Register
```javascript
const result = await api.register('user@example.com', 'password123', 'John Doe');
// Returns: { message, userId, email }
```

### Login
```javascript
const result = await api.login('user@example.com', 'password123');
// Returns: { token, user, subscription }
// Token stored in localStorage
```

### Protected Requests
```javascript
const profile = await api.getProfile();
// Automatically includes Authorization header
```

## Subscription Plans

| Plan | Price | Features |
|------|-------|----------|
| **Starter** | GHS 20 | 2 daily tips, Email support, 7-day access |
| **Pro** | GHS 50 | 8 daily tips, Priority support, 30-day access |
| **VIP** | GHS 100 | 20+ daily tips, Live alerts, 90-day access |
| **Elite** | GHS 200 | Unlimited tips, Private calls, 1-year access |

## Production Deployment Checklist

### Database
- [ ] Replace in-memory storage with PostgreSQL + Prisma
- [ ] Run: `npm install @prisma/client prisma`
- [ ] Create `prisma/schema.prisma` (use schema in backend/prisma/schema.prisma)
- [ ] Run migrations: `npx prisma migrate deploy`

### Authentication
- [ ] Use bcryptjs for password hashing (already integrated)
- [ ] Implement password reset flow
- [ ] Add email verification
- [ ] Add refresh token rotation

### Payment Processing
- [ ] Create Stripe account (stripe.com)
- [ ] Generate API keys (test mode first)
- [ ] Create products and prices in Stripe dashboard
- [ ] Update `stripePriceId` in plans configuration
- [ ] Configure webhook endpoint: `https://yourdomain.com/api/payments/webhook`
- [ ] Set webhook secret in `.env`

### Email Service
- [ ] Set up Mailgun (mailgun.com) or SendGrid
- [ ] Update email service in `server.js`
- [ ] Test email sending
- [ ] Create email templates (welcome, confirmation, cancellation)

### Hosting
- [ ] Deploy backend (Vercel, Heroku, AWS, DigitalOcean)
- [ ] Deploy frontend (Vercel, Netlify, GitHub Pages)
- [ ] Set `CLIENT_ORIGIN` and `STRIPE_WEBHOOK_SECRET` in production
- [ ] Enable HTTPS only
- [ ] Set up monitoring (error tracking, uptime monitoring)

### Security
- [ ] Enable CORS for production domain only
- [ ] Store secrets in environment variables (never commit)
- [ ] Implement rate limiting (already enabled)
- [ ] Add CSRF protection if needed
- [ ] Set security headers (Helmet already enabled)
- [ ] Regular security audits
- [ ] Keep dependencies updated

### Legal & Compliance
- [ ] Terms of Service (drafted by lawyer)
- [ ] Privacy Policy (GDPR/CCPA compliant)
- [ ] Subscription cancellation policy
- [ ] Refund policy
- [ ] Data retention policy
- [ ] Contact/support process

## Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=production
CLIENT_ORIGIN=https://yourdomain.com

# JWT
JWT_SECRET=<generate-random-string>
JWT_EXPIRES_IN=7d

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Database
DATABASE_URL=postgresql://user:pass@host/db

# Email
MAILGUN_DOMAIN=mg.yourdomain.com
MAILGUN_API_KEY=key-...
MAILGUN_FROM_EMAIL=noreply@yourdomain.com

# Admin
ADMIN_KEY=<secure-admin-password>
```

## Testing

### Register & Login
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test User"}'

curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

### Get Protected Data
```bash
curl -H 'Authorization: Bearer <token>' http://localhost:3000/api/user/profile
```

### Admin Stats
```bash
curl -H 'X-Admin-Key: <admin-key>' http://localhost:3000/api/admin/stats
```

## Troubleshooting

**Stripe checkout fails**: Check `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in .env

**CORS errors**: Verify `CLIENT_ORIGIN` matches your frontend URL

**Webhook not working**: Ensure webhook endpoint is publicly accessible with HTTPS

**Email not sending**: Verify Mailgun credentials and domain is verified

## Next Steps

1. Set up PostgreSQL database
2. Integrate Stripe production keys
3. Configure email service
4. Deploy to production
5. Monitor errors and performance
6. Gather user feedback and iterate

## Support

- Stripe docs: https://stripe.com/docs
- Prisma docs: https://www.prisma.io/docs
- Express docs: https://expressjs.com
