import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "@/lib/startup"; // Initialize app and validate environment

const inter = Inter({ subsets: ["latin"] });

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "https://ai.xantuus.com";

const TITLE = "Xantuus AI";
const DESCRIPTION =
  "Claude, GPT and Gemini in one place — with ready-made templates, automation, and one credit balance instead of five subscriptions.";

export const metadata: Metadata = {
  // Without metadataBase, Next cannot turn the relative /opengraph-image path
  // into the absolute URL that link unfurlers require, and emits no image.
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    // X ships no twitter:image of its own here; declaring the large card makes
    // it fall back to og:image rather than rendering a bare link.
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Applies the saved/OS-preferred theme class before first paint, on every
// page — not just ones that happen to render <ThemeToggle/>. Without this,
// a direct load of a page without ThemeToggle mounted (e.g. /pricing)
// ignored the user's saved preference and always rendered light mode.
const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var isDark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', isDark);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={inter.className}>
        <ErrorBoundary>
          <SessionProvider>
            {children}
          </SessionProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}