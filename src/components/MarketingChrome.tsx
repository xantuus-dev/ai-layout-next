import Link from 'next/link';
import ThemeToggle from './ThemeToggle';

/**
 * Header/footer for the standalone marketing pages (/solutions/*).
 *
 * Deliberately not the LandingPage header: that one owns AuthModal state and
 * has to be a client component. These pages are static, so the chrome stays a
 * server component and links to the landing page for sign-up instead.
 */
export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center min-w-0" aria-label="Xantuus AI home">
          <img
            src="/xantuus-wordmark-dark.png"
            alt="Xantuus AI"
            className="w-[132px] md:w-[168px] max-w-full h-auto object-contain object-left dark:hidden"
          />
          <img
            src="/xantuus-wordmark-white.png"
            alt="Xantuus AI"
            className="w-[132px] md:w-[168px] max-w-full h-auto object-contain object-left hidden dark:block"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <Link href="/solutions" className="hover:text-foreground transition-colors">Solutions</Link>
          <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            href="/contact"
            className="px-5 py-2 text-sm font-semibold gradient-primary hover:gradient-primary-hover text-white rounded-full transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            Talk to us
          </Link>
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center min-w-0">
          <img
            src="/xantuus-wordmark-dark.png"
            alt="Xantuus AI"
            className="w-[112px] max-w-full h-auto object-contain object-left dark:hidden"
          />
          <img
            src="/xantuus-wordmark-white.png"
            alt="Xantuus AI"
            className="w-[112px] max-w-full h-auto object-contain object-left hidden dark:block"
          />
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
          <Link href="/solutions" className="hover:text-foreground transition-colors">Solutions</Link>
          <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
        </nav>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Xantuus AI</p>
      </div>
    </footer>
  );
}
