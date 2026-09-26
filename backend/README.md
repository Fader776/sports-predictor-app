# Real Business Backend

This is a production-ready Express API for a professional sports analytics subscription service.

## Setup

### 1. Prerequisites
- Node.js 20+
- PostgreSQL database
- Stripe account (for payments)
- Mailgun account (for transactional emails)

### 2. Install dependencies

```bash
cd backend
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your actual credentials
```

### 4. Set up database

```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5. Start the server

```bash
npm run dev    # Development with auto-reload
npm start      # Production
```

API health check: `http://localhost:3000/api/health`

## Architecture

### Database (PostgreSQL + Prisma ORM)
- **Users**: Authentication, subscription tracking
- **Plans**: Tiered subscription definitions
- **Orders**: Payment transactions and history
- **Subscriptions**: Active user subscriptions
- **Sessions**: JWT session tokens
- **Predictions**: Match predictions and analysis
- **EmailLog**: Transactional email tracking

### Payment Flow (Stripe)
1. User selects plan → `POST /api/checkout/session`
2. Backend creates Stripe checkout session
3. User completes payment on Stripe hosted checkout
4. Stripe sends signed webhook to `/api/payments/webhook`
5. Backend verifies webhook, creates subscription, sends email
6. User receives access via JWT token

### Authentication
- Register → `POST /api/auth/register`
- Login → `POST /api/auth/login`
- Returns JWT token valid for 7 days
- Protected endpoints require Bearer token

### Rate Limiting
- Auth endpoints: 5 requests per 15 minutes
- API endpoints: 100 requests per 15 minutes

## Implementation TODO

- [ ] Complete database queries (replace TODO comments)
- [ ] Add email service (Mailgun integration)
- [ ] Implement Stripe webhook verification
- [ ] Add password hashing and comparison
- [ ] Session management and token refresh
- [ ] Email verification flow
- [ ] Refund handling
- [ ] Admin dashboard endpoints
- [ ] Prediction CRUD endpoints
- [ ] User dashboard endpoints
- [ ] Logging and monitoring
- [ ] Unit and integration tests
- [ ] API documentation (OpenAPI/Swagger)

## Security Checklist

- [x] CORS configured for frontend origin
- [x] Helmet security headers enabled
- [x] Rate limiting on auth endpoints
- [x] Request body size limit (20kb)
- [x] Input validation with Zod
- [ ] Password hashing (bcryptjs integration ready)
- [ ] JWT token management
- [ ] HTTPS enforced (production only)
- [ ] Environment secrets not in Git
- [ ] SQL injection prevention (Prisma ORM)
- [ ] CSRF protection (if needed)
- [ ] Stripe webhook signature verification
- [ ] PCI compliance (no card storage)

## Deployment

### Environment variables for production
```
NODE_ENV=production
DATABASE_URL=postgresql://prod-user:prod-pass@prod-host:5432/stickers_prod
JWT_SECRET=<generate-long-random-string>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
MAILGUN_API_KEY=key-...
CLIENT_ORIGIN=https://yourdomain.com
```

### Recommended hosting
- **App**: Vercel, Heroku, AWS EC2, DigitalOcean
- **Database**: AWS RDS, DigitalOcean Managed, Heroku Postgres
- **Email**: Mailgun, SendGrid, AWS SES
- **Payments**: Stripe (with webhook to production URL)

## Support

For Stripe integration help, see: https://stripe.com/docs/payments/checkout
For database help, see: https://www.prisma.io/docs
