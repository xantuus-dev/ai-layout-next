# Stripe Payment Testing Guide

## 🧪 Test Cards for Stripe

### Successful Payments
```
Card Number:     4242 4242 4242 4242
Expiry:          Any future date (e.g., 12/34)
CVC:             Any 3 digits (e.g., 123)
ZIP:             Any 5 digits (e.g., 12345)
```

### Test Different Scenarios

| Scenario | Card Number | Result |
|----------|-------------|--------|
| Success | 4242 4242 4242 4242 | Payment succeeds |
| Declined | 4000 0000 0000 0002 | Card declined |
| Insufficient funds | 4000 0000 0000 9995 | Insufficient funds |
| Expired card | 4000 0000 0000 0069 | Expired card |
| Processing error | 4000 0000 0000 0119 | Processing error |
| 3D Secure required | 4000 0027 6000 3184 | Requires authentication |

## 📋 Testing Checklist

### 1. Subscription Flow (Pro Plan - $29/month)

**Steps:**
1. Go to: https://ai-layout-next-4nj8mqh42-david-archies-projects-af46d129.vercel.app/pricing
2. Click "Upgrade to Pro" button
3. Redirected to Stripe Checkout
4. Enter test card: 4242 4242 4242 4242
5. Enter email, name, card details
6. Click "Subscribe"
7. Redirected back to `/settings/billing?success=true`

**Expected Results:**
- ✅ User's plan updated to "pro"
- ✅ Monthly credits increased to 12,000
- ✅ Stripe subscription ID saved in database
- ✅ Subscription visible in Stripe Dashboard

**Verify in Database:**
```sql
SELECT id, email, plan, monthlyCredits, stripeSubscriptionId
FROM "User"
WHERE email = 'your-test-email@example.com';
```

### 2. Subscription Flow (Enterprise Plan - $199/month)

**Steps:**
1. Go to pricing page
2. Click "Upgrade to Enterprise" button
3. Complete checkout with test card
4. Verify redirect to success page

**Expected Results:**
- ✅ User's plan updated to "enterprise"
- ✅ Monthly credits increased to 40,000
- ✅ Subscription active in Stripe

### 3. Billing Portal

**Steps:**
1. Go to: https://ai-layout-next-4nj8mqh42-david-archies-projects-af46d129.vercel.app/settings/billing
2. Click "Manage Subscription" button
3. Redirected to Stripe Customer Portal
4. View subscription details
5. Try canceling subscription

**Expected Results:**
- ✅ Portal loads successfully
- ✅ Shows current subscription
- ✅ Can update payment method
- ✅ Can cancel subscription

### 4. Webhook Events

**Test in Stripe Dashboard:**
1. Go to: Developers → Webhooks
2. Click on your webhook endpoint
3. Click "Send test webhook"
4. Select event type:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `invoice.payment_succeeded`

**Expected Results:**
- ✅ Webhook receives event (200 response)
- ✅ User data updated in database
- ✅ No errors in logs

### 5. Subscription Cancellation

**Steps:**
1. In Stripe Dashboard, go to Customers
2. Find test customer
3. Click on their subscription
4. Click "Cancel subscription"
5. Choose "Cancel immediately"

**Expected Results:**
- ✅ Webhook fires `customer.subscription.deleted`
- ✅ User's plan reverted to "free"
- ✅ Credits reset to 4,000
- ✅ stripeSubscriptionId cleared

### 6. Failed Payment

**Steps:**
1. Create subscription with test card
2. In Stripe Dashboard, go to subscription
3. Click "Update subscription"
4. Change to declined card: 4000 0000 0000 0341
5. Try to charge

**Expected Results:**
- ✅ Payment fails
- ✅ `invoice.payment_failed` webhook fires
- ✅ User notified (if notifications set up)
- ✅ Subscription marked as past_due

## 🔍 Debugging Tips

### Check Vercel Logs
```bash
vercel logs https://ai-layout-next-4nj8mqh42-david-archies-projects-af46d129.vercel.app --follow
```

### Check Stripe Webhook Logs
1. Go to: Developers → Webhooks
2. Click on your endpoint
3. View "Recent deliveries"
4. Check response codes and bodies

### Common Issues

**Issue: "Stripe is not configured"**
- Solution: Add STRIPE_SECRET_KEY to Vercel env vars

**Issue: "Invalid signature"**
- Solution: Update STRIPE_WEBHOOK_SECRET in Vercel

**Issue: User plan not updating**
- Solution: Check webhook logs in Stripe Dashboard
- Verify userId in metadata
- Check database for stripeSubscriptionId

**Issue: Redirect URI not working**
- Solution: Verify NEXTAUTH_URL is set correctly

## 📊 Post-Launch Monitoring

### Daily Checks
- Monitor webhook delivery success rate
- Check for failed payments
- Review subscription churn

### Weekly Checks
- Analyze MRR (Monthly Recurring Revenue)
- Review customer feedback
- Check for fraud patterns

### Monthly Checks
- Reconcile Stripe data with database
- Review pricing effectiveness
- Analyze conversion rates

## 🚀 Going Live (Production)

### Before Launch:
1. ✅ Switch from test keys to live keys
2. ✅ Update webhook URL to production domain
3. ✅ Test with real card (charge $0.50, then refund)
4. ✅ Set up Stripe email notifications
5. ✅ Configure tax collection (if needed)
6. ✅ Set up fraud detection rules
7. ✅ Enable 3D Secure if required by region

### After Launch:
1. Monitor first 10 transactions closely
2. Set up alerts for failed webhooks
3. Create refund policy page
4. Set up customer support email
5. Monitor churn rate weekly

## 🎯 Success Metrics

Track these KPIs:
- **Conversion Rate**: Free → Pro/Enterprise
- **MRR**: Monthly Recurring Revenue
- **Churn Rate**: % of canceled subscriptions
- **LTV**: Customer Lifetime Value
- **CAC**: Customer Acquisition Cost
- **ARPU**: Average Revenue Per User

## 📞 Support Resources

- Stripe Documentation: https://stripe.com/docs
- Stripe API Reference: https://stripe.com/docs/api
- Test Cards: https://stripe.com/docs/testing
- Webhook Events: https://stripe.com/docs/api/events/types
- Support: https://support.stripe.com

## ✅ Pre-Launch Checklist

- [ ] Stripe account activated
- [ ] Products created (Pro, Enterprise)
- [ ] Webhook endpoint configured
- [ ] Test mode: All tests passing
- [ ] Environment variables added to Vercel
- [ ] Redeployed to production
- [ ] Test purchase completed successfully
- [ ] Subscription cancellation tested
- [ ] Webhook events verified
- [ ] Customer portal tested
- [ ] Ready to switch to live keys! 🚀
