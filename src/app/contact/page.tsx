import MiniCard from '@/components/ui/MiniCard';
import { SOLUTIONS } from '@/lib/solutions';
import { MarketingHeader, MarketingFooter } from '@/components/MarketingChrome';

interface ContactPageProps {
  searchParams: { prompt?: string };
}

export default function ContactPage({ searchParams }: ContactPageProps) {
  const prompt = searchParams.prompt;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <MarketingHeader />

      <main className="p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-4 text-gray-900 dark:text-white">
          Get in Touch
        </h1>

        {prompt && (
          <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
              You're interested in:
            </p>
            <p className="text-lg font-semibold text-gray-900 dark:text-white">
              {prompt}
            </p>
          </div>
        )}

        <p className="text-center text-gray-600 dark:text-gray-300 mb-12">
          Let's discuss how we can help with your AI needs
        </p>

        {/* Each card links to its solution page, which in turn links back here
            with ?prompt= set — so the form arrives pre-scoped to what they read. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {SOLUTIONS.map((solution) => (
            <MiniCard
              key={solution.slug}
              title={solution.name}
              badges={solution.badge ? [solution.badge] : undefined}
              cta={[
                {
                  text: solution.ctaLabel,
                  href: `/solutions/${solution.slug}`,
                  variant: 'primary',
                },
              ]}
            >
              <p className="text-gray-600 dark:text-gray-300">{solution.summary}</p>
            </MiniCard>
          ))}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
            Contact Form
          </h2>

          <form className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="your.email@example.com"
              />
            </div>

            <div>
              <label htmlFor="service" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Service Interested In
              </label>
              <select
                id="service"
                name="service"
                defaultValue={prompt || ''}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              >
                <option value="">Select a service</option>
                <option value="AI Agent">AI Agent</option>
                <option value="Automation">Automation</option>
                <option value="AI Security">AI Security</option>
                <option value="Pipelines">Pipelines</option>
                <option value="Dashboards">Dashboards</option>
                <option value="Chatbots">Chatbots</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Message
              </label>
              <textarea
                id="message"
                name="message"
                rows={5}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                placeholder="Tell us about your project..."
              />
            </div>

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity shadow-md"
            >
              Send Message
            </button>
          </form>
        </div>
      </div>
      </main>

      <MarketingFooter />
    </div>
  );
}
