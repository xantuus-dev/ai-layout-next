export const metadata = {
  title: 'Terms of Service — Xantuus AI',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen p-4 md:p-8 bg-gray-50 dark:bg-gray-900">
      <div className="max-w-3xl mx-auto py-8">
        <div className="mb-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-800 rounded-lg text-sm text-yellow-900 dark:text-yellow-200">
          <strong>Draft — not legal advice.</strong> This page is a starting template generated to describe
          this product's actual features and third-party services. It has not been reviewed by a lawyer.
          Have it reviewed before treating it as your binding Terms of Service.
        </div>

        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Last updated: [DATE]</p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-6 text-gray-700 dark:text-gray-300">
          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">1. Acceptance of Terms</h2>
            <p>
              By creating an account or using Xantuus AI (the "Service"), you agree to these Terms of Service.
              If you don't agree, don't use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">2. What the Service Does</h2>
            <p>
              Xantuus AI provides AI-powered chat, prompt templates, image generation, workflow automation,
              and browser automation features, built on top of third-party AI models (see Section 6) and
              billed using a credit system.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">3. Accounts</h2>
            <p>
              You must sign in via a supported provider (currently Google or Apple) to use most features.
              You're responsible for activity on your account and for keeping your credentials secure.
              You must be legally able to enter into this agreement to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">4. Credits, Billing &amp; Subscriptions</h2>
            <p>
              Access to AI features is metered using credits. Free accounts receive a monthly credit
              allowance; paid plans and one-time credit top-ups are available via Stripe. Mobile
              subscriptions may be processed via RevenueCat. Unless stated otherwise:
            </p>
            <ul className="list-disc pl-6">
              <li>Monthly credit allowances reset each billing cycle and do not roll over.</li>
              <li>Purchased credit top-ups are consumed before your next scheduled reset and do not carry over past it.</li>
              <li>Subscriptions renew automatically until cancelled; you can cancel any time from your billing settings.</li>
              <li>[Fill in your actual refund policy here.]</li>
            </ul>
            <p>
              If a team owner shares their credit pool with invited team members, the owner is responsible
              for all usage billed to that pool, including usage by members they've invited.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">5. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-6">
              <li>Violate any law, or the rights of any third party;</li>
              <li>Generate content that is illegal, abusive, or infringing;</li>
              <li>Attempt to circumvent credit limits, rate limits, or access controls;</li>
              <li>Use the browser automation feature against a third-party website in violation of that site's own terms of service;</li>
              <li>Interfere with or disrupt the Service or its infrastructure.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">6. Third-Party AI Providers</h2>
            <p>
              AI responses are generated using third-party models (currently Anthropic Claude, OpenAI GPT,
              and Google Gemini, depending on what you select). Outputs may be inaccurate, incomplete, or
              inappropriate for your use case. You are responsible for reviewing and validating any AI
              output before relying on it, especially for business, legal, medical, or financial decisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">7. Browser Automation</h2>
            <p>
              The Service's browser automation feature acts on your behalf, at your direction, to navigate
              and interact with third-party websites. You are solely responsible for ensuring your use of
              this feature complies with the terms of service of any site you direct it to.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">8. Intellectual Property</h2>
            <p>
              You retain ownership of content you submit to the Service. Subject to these Terms, you own
              the outputs generated for you, to the extent permitted by the underlying AI providers' own
              terms. [Confirm this against each provider's actual output-ownership terms before publishing.]
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">9. Termination</h2>
            <p>
              We may suspend or terminate accounts that violate these Terms. You may stop using the Service
              and delete your account at any time from account settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">10. Disclaimers &amp; Limitation of Liability</h2>
            <p>
              The Service is provided "as is" without warranties of any kind. To the maximum extent
              permitted by law, we are not liable for indirect, incidental, or consequential damages
              arising from your use of the Service, including reliance on AI-generated output.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">11. Changes to These Terms</h2>
            <p>We may update these Terms from time to time. Continued use of the Service after a change constitutes acceptance.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">12. Contact</h2>
            <p>Questions about these Terms? Contact us at <a href="/contact" className="text-blue-600 dark:text-blue-400 underline">our contact page</a>.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
