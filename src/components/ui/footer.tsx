'use client';

import React, { type FC, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  Shield,
  BadgeCheck,
  CircleCheck,
  Linkedin,
  Twitter,
  Youtube,
  Instagram,
  MapPin,
  Phone,
  Mail,
} from 'lucide-react';

/* Mirror of the footer on www.xantuus.com so the marketing site and the app
   read as one property. Deliberately NOT theme-adaptive: the source footer is
   always dark (bg-gray-900) regardless of the page above it, so the colours
   here are literal rather than semantic tokens. Changing them to `bg-muted` and
   friends would make this footer light in light mode and break the match. */

const MAIN_SITE = 'https://www.xantuus.com';

type FooterLink = { label: string; href: string };

/** Internal app routes go through next/link; anything else is a plain anchor. */
const FooterAnchor: FC<{
  href: string;
  className?: string;
  children: ReactNode;
  label?: string;
}> = ({ href, className, children, label }) => {
  if (href.startsWith('/')) {
    return (
      <Link href={href} className={className} aria-label={label}>
        {children}
      </Link>
    );
  }
  const isExternal = href.startsWith('http');
  return (
    <a
      href={href}
      className={className}
      aria-label={label}
      {...(isExternal ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
    >
      {children}
    </a>
  );
};

interface FooterProps extends React.HTMLAttributes<HTMLElement> {
  logoSrc?: string;
  tagline?: string;
  description?: string;
  badges?: { label: string; icon: ReactNode }[];
  serviceLinks?: FooterLink[];
  companyLinks?: FooterLink[];
  socialLinks?: { label: string; href: string; icon: ReactNode }[];
  location?: string;
  phone?: string;
  email?: string;
  legalLinks?: FooterLink[];
}

export const Footer: FC<FooterProps> = ({
  // The footer sits on a dark ground, so the white wordmark is the only variant
  // needed. w-48 matches the 192px render on the marketing site.
  logoSrc = '/xantuus-wordmark-white.png',
  tagline = 'AI Engineering Solutions',
  description = 'Transforming businesses through intelligent engineering and custom AI solutions.',
  badges = [
    { label: 'SSL Secure', icon: <Shield className="h-4 w-4 text-emerald-400" /> },
    { label: 'SOC 2', icon: <BadgeCheck className="h-4 w-4 text-emerald-400" /> },
    { label: '100% Satisfaction', icon: <CircleCheck className="h-4 w-4 text-emerald-400" /> },
  ],
  /* Href notes: the marketing site itself still has `#` on most of these, so
     they are carried over as `#` rather than invented. The two that resolve
     live on the marketing site only, so they are absolute cross-domain links. */
  serviceLinks = [
    { label: 'AI Agent Engineering', href: '#' },
    { label: 'AI Cybersecurity', href: `${MAIN_SITE}/ai-security` },
    { label: 'Engineering Pipelines', href: '#' },
    { label: 'Data Integration', href: '#' },
    { label: 'Analytics Dashboards', href: '#' },
    { label: 'AI Strategy Consulting', href: '#' },
  ],
  companyLinks = [
    { label: 'About Us', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Docs', href: `${MAIN_SITE}/docs` },
    { label: 'Resources', href: '#' },
    // Contact, Privacy and Terms all exist in this app, so they stay local.
    { label: 'Contact', href: '/contact' },
  ],
  socialLinks = [
    { label: 'LinkedIn', href: 'https://www.linkedin.com/company/xantuus-ai/', icon: <Linkedin className="h-5 w-5" /> },
    { label: 'X', href: 'https://x.com/join_XantuusAI', icon: <Twitter className="h-5 w-5" /> },
    { label: 'YouTube', href: '#', icon: <Youtube className="h-5 w-5" /> },
    { label: 'Instagram', href: 'https://instagram.com/xantuus', icon: <Instagram className="h-5 w-5" /> },
  ],
  location = 'Charlotte, North Carolina',
  phone = '+1-704-905-4343',
  email = 'hello@xantuus.com',
  legalLinks = [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
  ],
  className,
  ...props
}) => {
  return (
    <footer className={cn('bg-gray-900 px-6 py-12 text-white', className)} {...props}>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-8 md:grid-cols-4">
          {/* Brand + trust badges */}
          <div>
            <Link href="/" aria-label="Xantuus AI home" className="inline-block">
              <img src={logoSrc} alt="Xantuus AI" className="mb-2 w-48 max-w-full h-auto object-contain" />
            </Link>
            <h3 className="mb-4 text-xl font-bold">{tagline}</h3>
            <p className="mb-4 text-gray-400">{description}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {badges.map((badge) => (
                <div
                  key={badge.label}
                  className="flex items-center space-x-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-1.5"
                >
                  {badge.icon}
                  <span className="text-xs text-gray-300">{badge.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="mb-4 text-lg font-semibold">Services</h4>
            <ul className="space-y-2 text-gray-400">
              {serviceLinks.map((link) => (
                <li key={link.label}>
                  <FooterAnchor href={link.href} className="transition-colors hover:text-white">
                    {link.label}
                  </FooterAnchor>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="mb-4 text-lg font-semibold">Company</h4>
            <ul className="space-y-2 text-gray-400">
              {companyLinks.map((link) => (
                <li key={link.label}>
                  <FooterAnchor href={link.href} className="transition-colors hover:text-white">
                    {link.label}
                  </FooterAnchor>
                </li>
              ))}
            </ul>
          </div>

          {/* Connect */}
          <div>
            <h4 className="mb-4 text-lg font-semibold">Connect</h4>
            <div className="mb-4 flex space-x-4">
              {socialLinks.map((link) => (
                <FooterAnchor
                  key={link.label}
                  href={link.href}
                  label={link.label}
                  className="text-gray-400 transition-colors hover:text-white"
                >
                  {link.icon}
                </FooterAnchor>
              ))}
            </div>
            <div className="space-y-1 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" />
                <span>{location}</span>
              </div>
              <a
                href={`tel:${phone.replace(/[^+\d]/g, '')}`}
                className="flex items-center gap-2 text-gray-400 transition-colors hover:text-white"
              >
                <Phone className="h-4 w-4 shrink-0" />
                <span>{phone}</span>
              </a>
              <a
                href={`mailto:${email}`}
                className="flex items-center gap-2 text-gray-400 transition-colors hover:text-white"
              >
                <Mail className="h-4 w-4 shrink-0" />
                <span>{email}</span>
              </a>
            </div>
          </div>
        </div>

        <div className="my-8 h-px w-full shrink-0 bg-gray-800" />

        <div className="flex flex-col items-center justify-between text-sm text-gray-400 md:flex-row">
          {/* The marketing site hardcodes 2024; this stays current on its own. */}
          <p>© {new Date().getFullYear()} Xantuus AI. All rights reserved.</p>
          <div className="mt-4 flex space-x-6 md:mt-0">
            {legalLinks.map((link) => (
              <FooterAnchor key={link.label} href={link.href} className="transition-colors hover:text-white">
                {link.label}
              </FooterAnchor>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
};
