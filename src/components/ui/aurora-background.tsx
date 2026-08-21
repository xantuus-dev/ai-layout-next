'use client';

/**
 * Decorative aurora + starfield backdrop.
 *
 * Renders three drifting colour fields behind its children, optionally over a
 * twinkling starfield, and fades the whole thing into the page background at
 * the edges so a section using it blends into whatever follows.
 *
 * Colours come from CSS variables (--aurora-color1..3, defined in globals.css
 * for both themes) rather than literals, so the backdrop follows the light/dark
 * toggle instead of being pinned to one theme. Callers can still override per
 * instance via the `gradientColors` prop.
 *
 * Star positions are generated from a seeded PRNG, not Math.random(): the
 * server and client must produce byte-identical markup or React reports a
 * hydration mismatch on every page load.
 */

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface AuroraBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Colour fields to paint, outermost first. Any CSS colour works; two or
   * three reads best. Defaults to the brand teal/emerald/violet tokens.
   */
  gradientColors?: string[];
  /** Seconds for one drift-and-pulse cycle. Larger is calmer. */
  pulseDuration?: number;
  /** Number of twinkling stars. Pass 0 to omit the starfield entirely. */
  starCount?: number;
  /** Fade the backdrop into the page background at the edges. */
  showRadialGradient?: boolean;
  children?: React.ReactNode;
}

/** Deterministic PRNG (mulberry32) — same sequence on server and client. */
function mulberry32(seed: number) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DEFAULT_COLORS = [
  'var(--aurora-color1)',
  'var(--aurora-color2)',
  'var(--aurora-color3)',
];

export function AuroraBackground({
  gradientColors = DEFAULT_COLORS,
  pulseDuration = 8,
  starCount = 80,
  showRadialGradient = true,
  className,
  children,
  style,
  ...rest
}: AuroraBackgroundProps) {
  const stars = useMemo(() => {
    if (starCount <= 0) return [];
    const rand = mulberry32(0x5eed);
    return Array.from({ length: starCount }, (_, i) => ({
      id: i,
      left: `${(rand() * 100).toFixed(3)}%`,
      top: `${(rand() * 100).toFixed(3)}%`,
      size: `${(rand() * 1.6 + 0.8).toFixed(2)}px`,
      duration: `${(rand() * 5 + 3).toFixed(2)}s`,
      delay: `${(rand() * 6).toFixed(2)}s`,
    }));
  }, [starCount]);

  // Fall back through the list so a caller passing only two colours still
  // gets a complete three-field composition rather than an undefined layer.
  const [c1, c2, c3] = [
    gradientColors[0] ?? DEFAULT_COLORS[0],
    gradientColors[1] ?? gradientColors[0] ?? DEFAULT_COLORS[1],
    gradientColors[2] ?? gradientColors[1] ?? gradientColors[0] ?? DEFAULT_COLORS[2],
  ];

  return (
    <div
      className={cn('relative isolate overflow-hidden', className)}
      style={
        {
          '--aurora-c1': c1,
          '--aurora-c2': c2,
          '--aurora-c3': c3,
          '--aurora-duration': `${pulseDuration}s`,
          ...style,
        } as React.CSSProperties
      }
      {...rest}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>

      {stars.length > 0 && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          {stars.map((star) => (
            <span
              key={star.id}
              className="aurora-star"
              style={
                {
                  left: star.left,
                  top: star.top,
                  width: star.size,
                  height: star.size,
                  '--twinkle-duration': star.duration,
                  '--twinkle-delay': star.delay,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {showRadialGradient && (
        <div aria-hidden="true" className="aurora-vignette pointer-events-none absolute inset-0 -z-10" />
      )}

      <div className="relative">{children}</div>
    </div>
  );
}

export default AuroraBackground;
