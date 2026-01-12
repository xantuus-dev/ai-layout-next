# Stripe Quick Start - 5 Minutes Setup ⚡

## 🚀 Fast Track Setup

### Step 1: Get Stripe Account (2 minutes)
```
1. Visit: https://dashboard.stripe.com/register
2. Sign up with email
3. Skip business details (you can add later)
4. Go to Developers → API keys
```

### Step 2: Run Setup Script (2 minutes)
```bash
cd /Users/darchie/platform/ai-layout/ai-layout-next
./setup-stripe.sh
```

The script will ask for:
1. **Secret Key** - Copy from Stripe Dashboard (sk_test_...)
2. **Publishable Key** - Copy from Stripe Dashboard (pk_test_...)
3. **Webhook Secret** - Create webhook first (see below)
4. **Pro Price ID** - Create product first (see below)
5. **Enterprise Price ID** - Create product first (see below)

### Step 3: Create Products (1 minute)

**In Stripe Dashboard:**

**Pro Plan:**
```
Name: Pro Plan
Price: $29.00 / month
Billing: Recurring
Copy the Price ID → paste in setup script
```

**Enterprise Plan:**
```
Name: Enterprise Plan
Price: $199.00 / month
Billing: Recurring
Copy the Price ID → paste in setup script
```

### Step 4: Create Webhook (1 minute)

**In Stripe Dashboard:**
```
1. Go to: Developers → Webhooks
2. Click: "+ Add endpoint"
3. URL: https://ai-layout-next-4nj8mqh42-david-archies-projects-af46d129.vercel.app/api/stripe/webhook
4. Select these events:
   - checkout.session.completed
   - customer.subscription.created
   - customer.subscription.updated
   - customer.subscription.deleted
   - invoice.payment_succeeded
   - invoice.payment_failed
5. Click "Add endpoint"
6. Copy Signing Secret → paste in setup script
```

### Step 5: Deploy & Test (1 minute)
```bash
# Redeploy with new env vars
vercel --prod

# Test the payment flow
# Go to: https://ai-layout-next-4nj8mqh42-david-archies-projects-af46d129.vercel.app/pricing
# Click "Upgrade to Pro"
# Use test card: 4242 4242 4242 4242
```

## ✅ That's it! Payments are now live (in test mode)

---

## 🔄 Alternative: Manual Setup

If you prefer to add environment variables manually:

```bash
# Add each variable individually
echo "sk_test_YOUR_KEY" | vercel env add STRIPE_SECRET_KEY production
echo "pk_test_YOUR_KEY" | vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
echo "whsec_YOUR_SECRET" | vercel env add STRIPE_WEBHOOK_SECRET production
echo "price_YOUR_PRO_ID" | vercel env add STRIPE_PRO_PRICE_ID production
echo "price_YOUR_ENT_ID" | vercel env add STRIPE_ENTERPRISE_PRICE_ID production

# Redeploy
vercel --prod
```

---

## 🧪 Quick Test

After setup, test immediately:

```bash
# 1. Visit pricing page
open https://ai-layout-next-4nj8mqh42-david-archies-projects-af46d129.vercel.app/pricing

# 2. Click "Upgrade to Pro"

# 3. Use test card:
Card: 4242 4242 4242 4242
Expiry: 12/34
CVC: 123
ZIP: 12345

# 4. Complete checkout

# 5. Verify success redirect
```

---

## 📊 Verify It Worked

Check these 3 things:

1. **Stripe Dashboard**
   - Go to: Payments
   - You should see the test payment

2. **Database**
   - User's plan should be "pro"
   - monthlyCredits should be 12000

3. **Billing Page**
   - Visit: /settings/billing
   - Should show "Pro Plan" active

---

## 🎉 Success!

Your payment system is now live. To go production:

1. Switch to Live API keys in Stripe Dashboard
2. Replace test keys in Vercel with live keys
3. Update webhook URL to production domain
4. Test with a real card (charge $0.50, then refund)
5. You're ready to accept real payments! 💰

---

## 🆘 Need Help?

**Webhook not working?**
```bash
# Check logs
vercel logs --follow

# Verify webhook in Stripe
# Go to: Developers → Webhooks → Click your webhook → Recent deliveries
```

**Payment not updating user?**
```bash
# Check if userId is in metadata
# Go to Stripe Dashboard → Customers → Find customer → Check metadata
```

**Still stuck?**
- Read: STRIPE_TESTING_GUIDE.md
- Stripe Docs: https://stripe.com/docs
- Stripe Support: https://support.stripe.com
