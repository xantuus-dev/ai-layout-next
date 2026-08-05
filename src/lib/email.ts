import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

export const resend = resendApiKey ? new Resend(resendApiKey) : null;

export const isEmailEnabled = () => !!resend;

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Xantuus AI <onboarding@resend.dev>';

/**
 * Send a team invite email. Returns whether it was actually sent —
 * false (not an error) when RESEND_API_KEY isn't configured, so callers
 * can still surface the accept link directly instead of failing.
 */
export async function sendTeamInviteEmail(params: {
  to: string;
  inviterName: string;
  acceptUrl: string;
}): Promise<{ sent: boolean }> {
  if (!resend) {
    console.warn('⚠️  RESEND_API_KEY not configured — skipping team invite email');
    return { sent: false };
  }

  const { to, inviterName, acceptUrl } = params;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `${inviterName} invited you to join their team on Xantuus AI`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>You've been invited to a team</h2>
          <p><strong>${inviterName}</strong> invited you to join their team on Xantuus AI. You'll share their credit pool for AI usage — no separate plan needed.</p>
          <p>
            <a href="${acceptUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px;">
              Accept invite
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">This invite expires in 7 days. If you don't recognize this, you can ignore this email.</p>
        </div>
      `,
    });
    return { sent: true };
  } catch (error) {
    console.error('Error sending team invite email:', error);
    return { sent: false };
  }
}

/**
 * Send a payment-failed notice. Same fire-and-forget semantics as the
 * invite email — a missing RESEND_API_KEY should never block the webhook
 * from finishing, it just means the customer doesn't get told (the
 * paymentFailed flag/banner still cover it in-app).
 */
export async function sendPaymentFailedEmail(params: {
  to: string;
  name: string | null;
  billingUrl: string;
}): Promise<{ sent: boolean }> {
  if (!resend) {
    console.warn('⚠️  RESEND_API_KEY not configured — skipping payment-failed email');
    return { sent: false };
  }

  const { to, name, billingUrl } = params;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Action needed: your payment didn't go through`,
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>We couldn't process your payment</h2>
          <p>Hi ${name || 'there'},</p>
          <p>Your most recent payment for Xantuus AI failed. Your account and credits are still active for now, but please update your payment method to avoid interruption.</p>
          <p>
            <a href="${billingUrl}" style="display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 8px;">
              Update payment method
            </a>
          </p>
          <p style="color: #6b7280; font-size: 14px;">If you've already updated your payment info, you can ignore this email.</p>
        </div>
      `,
    });
    return { sent: true };
  } catch (error) {
    console.error('Error sending payment-failed email:', error);
    return { sent: false };
  }
}

/**
 * Send an 80%/100% credit usage alert. Same fire-and-forget semantics —
 * a missing RESEND_API_KEY just means the alert doesn't go out; the
 * threshold-tracking fields on User still prevent duplicate sends once
 * email is configured.
 */
export async function sendUsageAlertEmail(params: {
  to: string;
  name: string | null;
  threshold: 80 | 100;
  creditsUsed: number;
  monthlyCredits: number;
  billingUrl: string;
}): Promise<{ sent: boolean }> {
  if (!resend) {
    console.warn('⚠️  RESEND_API_KEY not configured — skipping usage alert email');
    return { sent: false };
  }

  const { to, name, threshold, creditsUsed, monthlyCredits, billingUrl } = params;
  const isFull = threshold === 100;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: isFull
        ? "You've used all your credits this month"
        : "You've used 80% of your credits this month",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>${isFull ? "You're out of credits" : "Heads up — you're at 80% usage"}</h2>
          <p>Hi ${name || 'there'},</p>
          <p>
            You've used <strong>${creditsUsed.toLocaleString()} of ${monthlyCredits.toLocaleString()}</strong>
            credits this billing cycle.
            ${isFull
              ? 'New requests will be blocked until your credits reset or you add more.'
              : "You're getting close to your limit — consider upgrading or buying a top-up before you run out."}
          </p>
          <p>
            <a href="${billingUrl}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px;">
              ${isFull ? 'Upgrade or buy credits' : 'Manage plan'}
            </a>
          </p>
        </div>
      `,
    });
    return { sent: true };
  } catch (error) {
    console.error('Error sending usage alert email:', error);
    return { sent: false };
  }
}
