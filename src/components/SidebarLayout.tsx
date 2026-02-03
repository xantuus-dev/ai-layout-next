'use client';

/**
 * Sidebar Layout Component
 *
 * Wraps page content with sidebar navigation
 * Provides proper spacing and responsive behavior
 */

import { useState } from 'react';
import Sidebar from './Sidebar';

interface SidebarLayoutProps {
  children: React.ReactNode;
}

export default function SidebarLayout({ children }: SidebarLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="relative min-h-screen bg-background">
      <Sidebar />

      {/* Main Content Area with proper margin */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          isCollapsed ? 'lg:ml-20' : 'lg:ml-64'
        }`}
      >
        <div className="ml-0 lg:ml-0">
          {children}
        </div>
      </div>
    </div>
  );
}
