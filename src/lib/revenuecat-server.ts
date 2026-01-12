// RevenueCat Server-Side API Integration
// Used for backend operations and webhook handling

const REVENUECAT_API_BASE = 'https://api.revenuecat.com/v1';

const getHeaders = (): Record<string, string> => {
  if (!process.env.REVENUECAT_SECRET_KEY) {
    throw new Error('REVENUECAT_SECRET_KEY not configured');
  }

  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.REVENUECAT_SECRET_KEY}`,
    'X-Platform': 'stripe',
  };
};

// Get subscriber info
export const getSubscriber = async (userId: string) => {
  try {
    const response = await fetch(
      `${REVENUECAT_API_BASE}/subscribers/${userId}`,
      {
        method: 'GET',
        headers: getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`RevenueCat API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching subscriber:', error);
    return null;
  }
};

// Get active entitlements for user
export const getActiveEntitlements = async (userId: string) => {
  const subscriber = await getSubscriber(userId);

  if (!subscriber) return [];

  const entitlements = subscriber.subscriber?.entitlements || {};
  return Object.keys(entitlements).filter(
    (key) => entitlements[key].expires_date === null ||
    new Date(entitlements[key].expires_date) > new Date()
  );
};

// Check if user has specific entitlement
export const hasEntitlement = async (
  userId: string,
  entitlement: string
): Promise<boolean> => {
  const entitlements = await getActiveEntitlements(userId);
  return entitlements.includes(entitlement);
};

// Get user's plan from entitlements
export const getUserPlan = async (userId: string): Promise<string> => {
  const subscriber = await getSubscriber(userId);

  if (!subscriber) return 'free';

  const entitlements = subscriber.subscriber?.entitlements || {};

  // Check for enterprise first, then pro
  if (entitlements.enterprise?.expires_date === null ||
      (entitlements.enterprise?.expires_date &&
       new Date(entitlements.enterprise.expires_date) > new Date())) {
    return 'enterprise';
  }

  if (entitlements.pro?.expires_date === null ||
      (entitlements.pro?.expires_date &&
       new Date(entitlements.pro.expires_date) > new Date())) {
    return 'pro';
  }

  return 'free';
};

// Create or update subscriber
export const updateSubscriber = async (
  userId: string,
  attributes: Record<string, any>
) => {
  try {
    const response = await fetch(
      `${REVENUECAT_API_BASE}/subscribers/${userId}`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ attributes }),
      }
    );

    if (!response.ok) {
      throw new Error(`RevenueCat API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating subscriber:', error);
    return null;
  }
};

// Grant promotional entitlement
export const grantPromotionalEntitlement = async (
  userId: string,
  entitlement: string,
  duration: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'lifetime'
) => {
  try {
    const response = await fetch(
      `${REVENUECAT_API_BASE}/subscribers/${userId}/entitlements/${entitlement}/promotional`,
      {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ duration }),
      }
    );

    if (!response.ok) {
      throw new Error(`RevenueCat API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error granting promotional entitlement:', error);
    return null;
  }
};

// Revoke promotional entitlement
export const revokePromotionalEntitlement = async (
  userId: string,
  entitlement: string
) => {
  try {
    const response = await fetch(
      `${REVENUECAT_API_BASE}/subscribers/${userId}/entitlements/${entitlement}/revoke_promotionals`,
      {
        method: 'POST',
        headers: getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`RevenueCat API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error revoking promotional entitlement:', error);
    return null;
  }
};

// Delete subscriber
export const deleteSubscriber = async (userId: string) => {
  try {
    const response = await fetch(
      `${REVENUECAT_API_BASE}/subscribers/${userId}`,
      {
        method: 'DELETE',
        headers: getHeaders(),
      }
    );

    if (!response.ok) {
      throw new Error(`RevenueCat API error: ${response.status}`);
    }

    return true;
  } catch (error) {
    console.error('Error deleting subscriber:', error);
    return false;
  }
};

// Get subscription info
export const getSubscription = async (userId: string) => {
  const subscriber = await getSubscriber(userId);

  if (!subscriber) return null;

  const subscriptions = subscriber.subscriber?.subscriptions || {};
  const activeSubscription = Object.values(subscriptions).find(
    (sub: any) => sub.expires_date === null ||
    new Date(sub.expires_date) > new Date()
  );

  return activeSubscription || null;
};

// Map credits from entitlements
export const getCreditsForUser = async (userId: string): Promise<number> => {
  const plan = await getUserPlan(userId);

  switch (plan) {
    case 'enterprise':
      return 500000;
    case 'pro':
      return 50000;
    case 'free':
    default:
      return 1000;
  }
};
