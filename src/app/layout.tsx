import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import "@/lib/startup"; // Initialize app and validate environment

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Xantuus AI",
  description: "AI-powered automation and agent platform",
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