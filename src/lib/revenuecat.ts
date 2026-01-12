// RevenueCat configuration with Stripe integration
import { Purchases } from '@revenuecat/purchases-js';

// Initialize RevenueCat
let purchases: any = null;

export const initRevenueCat = () => {
  if (typeof window === 'undefined') return null;

  if (!purchases && process.env.NEXT_PUBLIC_REVENUECAT_PUBLIC_KEY) {
    purchases = Purchases.configure({
      apiKey: process.env.NEXT_PUBLIC_REVENUECAT_PUBLIC_KEY,
      appUserId: '', // Will be set after login via loginRevenueCat
    });
  }

  return purchases;
};

export const getRevenueCat = () => {
  if (!purchases) {
    return initRevenueCat();
  }
  return purchases;
};

// RevenueCat Product/Entitlement IDs
export const REVENUECAT_PRODUCTS = {
  PRO: {
    identifier: 'pro_monthly',
    entitlement: 'pro',
    displayName: 'Pro Plan',
    price: 29,
  },
  ENTERPRISE: {
    identifier: 'enterprise_monthly',
    entitlement: 'enterprise',
    displayName: 'Enterprise Plan',
    price: 199,
  },
} as const;

// Map plan names to entitlements
export const PLAN_TO_ENTITLEMENT = {
  free: null,
  pro: 'pro',
  enterprise: 'enterprise',
} as const;

// Map entitlements to plan names
export const ENTITLEMENT_TO_PLAN = {
  pro: 'pro',
  enterprise: 'enterprise',
} as const;

// Check if user has active entitlement
export const hasEntitlement = async (entitlement: string): Promise<boolean> => {
  const rc = getRevenueCat();
  if (!rc) return false;

  try {
    const customerInfo = await rc.getCustomerInfo();
    return customerInfo.entitlements.active[entitlement] !== undefined;
  } catch (error) {
    console.error('Error checking entitlement:', error);
    return false;
  }
};

// Get customer info
export const getCustomerInfo = async () => {
  const rc = getRevenueCat();
  if (!rc) return null;

  try {
    return await rc.getCustomerInfo();
  } catch (error) {
    console.error('Error getting customer info:', error);
    return null;
  }
};

// Login user to RevenueCat
export const loginRevenueCat = async (userId: string) => {
  const rc = getRevenueCat();
  if (!rc) return;

  try {
    await rc.logIn(userId);
  } catch (error) {
    console.error('Error logging in to RevenueCat:', error);
  }
};

// Logout user from RevenueCat
export const logoutRevenueCat = async () => {
  const rc = getRevenueCat();
  if (!rc) return;

  try {
    await rc.logOut();
  } catch (error) {
    console.error('Error logging out from RevenueCat:', error);
  }
};

// Get available offerings
export const getOfferings = async () => {
  const rc = getRevenueCat();
  if (!rc) return null;

  try {
    return await rc.getOfferings();
  } catch (error) {
    console.error('Error getting offerings:', error);
    return null;
  }
};

// Purchase a product (redirects to Stripe Checkout)
export const purchaseProduct = async (productId: string) => {
  const rc = getRevenueCat();
  if (!rc) throw new Error('RevenueCat not initialized');

  try {
    const offerings = await rc.getOfferings();
    const product = offerings?.all[productId];

    if (!product) {
      throw new Error('Product not found');
    }

    // For web, this will redirect to Stripe Checkout
    const result = await rc.purchase({ product });
    return result;
  } catch (error) {
    console.error('Error purchasing product:', error);
    throw error;
  }
};

// Restore purchases
export const restorePurchases = async () => {
  const rc = getRevenueCat();
  if (!rc) return null;

  try {
    return await rc.restorePurchases();
  } catch (error) {
    console.error('Error restoring purchases:', error);
    return null;
  }
};

// Map credits from plan
export const getCreditsForPlan = (plan: string): number => {
  switch (plan) {
    case 'pro':
      return 50000;
    case 'enterprise':
      return 500000;
    case 'free':
    default:
      return 1000;
  }
};
