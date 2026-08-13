'use client';

import type React from 'react';

interface ShinyButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

/* Styles live in globals.css under .shiny-cta. The original component
   carried them in styled-jsx, which App Router only renders client-side
   (flash of unstyled button before hydration); global CSS server-renders.
   The inner <span> is structural — .shiny-cta span::before hosts the
   breathing inner glow. */
export function ShinyButton({ children, onClick, className = '' }: ShinyButtonProps) {
  return (
    <button className={`shiny-cta ${className}`} onClick={onClick}>
      <span>{children}</span>
    </button>
  );
}
