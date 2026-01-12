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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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