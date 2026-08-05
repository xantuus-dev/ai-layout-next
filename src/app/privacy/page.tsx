export const metadata = {
  title: 'Privacy Policy — Xantuus AI',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto py-8">
        <div className="mb-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-800 rounded-lg text-sm text-yellow-900 dark:text-yellow-200">
          <strong>Draft — not legal advice.</strong> This page is a starting template generated to describe
          this product's actual data flows and third-party processors. It has not been reviewed by a lawyer,
          and does not by itself satisfy GDPR/CCPA or similar regulatory requirements. Have it reviewed
          before treating it as your binding Privacy Policy.
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last updated: [DATE]</p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">1. What We Collect</h2>
            <ul className="list-disc pl-6">
              <li><strong>Account info:</strong> name, email, and profile image from your sign-in provider (Google or Apple).</li>
              <li><strong>Chat &amp; usage content:</strong> messages, prompts, uploaded files/attachments, and generated outputs.</li>
              <li><strong>Usage &amp; billing records:</strong> credits consumed, model used, token counts, and (if you subscribe) subscription/payment status from Stripe or RevenueCat — we do not store your card number ourselves.</li>
              <li><strong>Personalization data:</strong> anything you optionally add, like a nickname, occupation, bio, or custom AI instructions.</li>
              <li><strong>Connected-service tokens:</strong> if you connect Google Drive, Gmail, or Calendar, we store OAuth tokens needed to act on your behalf, and only for the scopes you approve.</li>
              <li><strong>Browser automation data:</strong> if you use the browser automation feature, session and page-interaction data needed to carry out your requests.</li>
              <li><strong>Memory data:</strong> if the memory/personalization feature is enabled, facts and context derived from your usage, used to improve future responses.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">2. How We Use It</h2>
            <ul className="list-disc pl-6">
              <li>To operate the Service: authenticate you, run your requests through AI providers, and track credit usage.</li>
              <li>To bill you, via Stripe or RevenueCat, for paid plans and credit purchases.</li>
              <li>To send account-related email (team invites, payment-failed notices, usage alerts) via our email provider.</li>
              <li>To improve the Service and personalize responses, where the memory/personalization features are enabled.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">3. Third Parties We Share Data With</h2>
            <p>We use the following processors to operate the Service. Content or account data may pass through them as described:</p>
            <ul className="list-disc pl-6">
              <li><strong>Anthropic, OpenAI, Google (Gemini):</strong> your chat/prompt content is sent to whichever AI provider you select, to generate a response.</li>
              <li><strong>Google:</strong> for sign-in, and — only if you connect them — Drive, Gmail, and Calendar access.</li>
              <li><strong>Stripe:</strong> payment processing for subscriptions and credit purchases.</li>
              <li><strong>RevenueCat:</strong> mobile subscription management.</li>
              <li><strong>Resend:</strong> delivery of transactional email (invites, billing, usage alerts).</li>
              <li><strong>Supabase:</strong> hosts our database.</li>
              <li><strong>Sentry:</strong> error monitoring — may capture technical details about a crash, not intentionally your chat content.</li>
              <li><strong>Vercel:</strong> hosts and serves the application.</li>
              <li><strong>Slack / Telegram:</strong> only if you explicitly connect these integrations.</li>
            </ul>
            <p>We do not sell your personal data.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">4. Data Retention</h2>
            <p>
              We retain account and usage data for as long as your account is active. [Fill in your actual
              retention period for deleted accounts, chat history, and usage records.]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">5. Your Rights</h2>
            <p>
              You can review and update your account information from account settings, disconnect any
              connected integration at any time, and request deletion of your account and associated data
              by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">6. Cookies</h2>
            <p>
              We use cookies required for authentication (session management) and, if enabled, basic
              analytics. [Fill in specifics if you add a dedicated analytics tool.]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">7. Children's Privacy</h2>
            <p>The Service is not directed at children under 13, and we do not knowingly collect data from them.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">8. Changes to This Policy</h2>
            <p>We may update this policy from time to time. Material changes will be reflected by updating the date above.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">9. Contact</h2>
            <p>Questions about this policy or a data request? Contact us at <a href="/contact" className="text-blue-600 dark:text-blue-400 underline">our contact page</a>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
