/**
 * Link-preview card for the site root.
 *
 * Next serves this at /opengraph-image and points og:image at it, so pasting a
 * Xantuus link into Slack, iMessage, LinkedIn, Discord or X renders a branded
 * card instead of a bare URL. Twitter has no separate twitter-image file — the
 * `summary_large_image` card declared in layout.tsx falls back to og:image.
 *
 * Rendered by Satori, which supports only a subset of CSS: flexbox but not
 * grid, and no `filter`. The hero's blurred glow orbs are therefore rebuilt as
 * radial-gradients, which Satori does support, rather than blurred circles.
 */
import { ImageResponse } from 'next/og';
import { readFile } from 'fs/promises';
import { join } from 'path';

// Node runtime so the wordmark can be read off disk; Satori needs the bytes
// inline, and edge has no filesystem.
export const runtime = 'nodejs';

export const alt = 'Xantuus AI — run your business tasks on every leading AI model';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Matches --background and the teal/emerald brand ramp in globals.css.
const BACKGROUND = '#0C0F14';
const TEAL = '#14B8A6';
const EMERALD = '#10B981';

export default async function OpengraphImage() {
  const wordmark = await readFile(join(process.cwd(), 'public', 'xantuus-wordmark-white.png'));
  const wordmarkSrc = `data:image/png;base64,${wordmark.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          backgroundColor: BACKGROUND,
          // Satori rejects the two-value ellipse form
          // (`radial-gradient(900px 500px at …)`) with "Missing comma before
          // color stops". The `circle <size> at <pos>` form parses correctly
          // and is close enough at this scale.
          backgroundImage: [
            `radial-gradient(circle 660px at 12% -10%, rgba(20,184,166,0.28), transparent 60%)`,
            `radial-gradient(circle 540px at 92% 8%, rgba(16,185,129,0.22), transparent 62%)`,
            `radial-gradient(circle 480px at 20% 115%, rgba(139,92,246,0.16), transparent 60%)`,
          ].join(','),
        }}
      >
        <img src={wordmarkSrc} width={300} alt="" style={{ objectFit: 'contain' }} />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              display: 'flex',
              fontSize: 62,
              lineHeight: 1.12,
              fontWeight: 700,
              color: '#FAFAFA',
              letterSpacing: '-0.02em',
              maxWidth: 1000,
            }}
          >
            Run your business tasks on every leading AI model
          </div>
          <div
            style={{
              display: 'flex',
              marginTop: 24,
              fontSize: 30,
              color: '#A2A7B0',
              maxWidth: 900,
            }}
          >
            Claude, GPT and Gemini in one place — one credit balance, not five subscriptions.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', fontSize: 26, color: '#A2A7B0' }}>ai.xantuus.com</div>
          <div
            style={{
              display: 'flex',
              width: 220,
              height: 8,
              borderRadius: 999,
              backgroundImage: `linear-gradient(to right, ${TEAL}, ${EMERALD})`,
            }}
          />
        </div>
      </div>
    ),
    size
  );
}
