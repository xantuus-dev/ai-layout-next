'use client';

/**
 * Settings Modal
 *
 * Full-screen dark-themed settings modal with sidebar navigation
 * Sections: Account, Settings, Usage, Personalization, Connectors, Integrations
 */

import { useState, useEffect } from 'react';
import { X, User, Settings as SettingsIcon, TrendingUp, Sparkles, Link2, Puzzle } from 'lucide-react';
import { PersonalizationSection } from './settings/PersonalizationSection';
import { AccountSection } from './settings/AccountSection';
import { SettingsSection } from './settings/SettingsSection';
import { UsageSection } from './settings/UsageSection';
import { ConnectorsSection } from './settings/ConnectorsSection';
import { IntegrationsSection } from './settings/IntegrationsSection';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  initialSection?: string;
}

type SectionType = 'account' | 'settings' | 'usage' | 'personalization' | 'connectors' | 'integrations';

interface NavItem {
  id: SectionType;
  label: string;
  icon: React.ElementType;
}

const navigationItems: NavItem[] = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
  { id: 'usage', label: 'Usage', icon: TrendingUp },
  { id: 'personalization', label: 'Personalization', icon: Sparkles },
  { id: 'connectors', label: 'Connectors', icon: Link2 },
  { id: 'integrations', label: 'Integrations', icon: Puzzle },
];

export function SettingsModal({ open, onClose, initialSection = 'account' }: SettingsModalProps) {
  const [activeSection, setActiveSection] = useState<SectionType>(initialSection as SectionType);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  // Reset to initial section when modal opens
  useEffect(() => {
    if (open && initialSection) {
      setActiveSection(initialSection as SectionType);
    }
  }, [open, initialSection]);

  if (!open) return null;

  const renderSection = () => {
    switch (activeSection) {
      case 'account':
        return <AccountSection />;
      case 'settings':
        return <SettingsSection />;
      case 'usage':
        return <UsageSection />;
      case 'personalization':
        return <PersonalizationSection />;
      case 'connectors':
        return <ConnectorsSection />;
      case 'integrations':
        return <IntegrationsSection />;
      default:
        return <AccountSection />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full h-full max-w-7xl mx-auto flex bg-[#1a1a1a] shadow-2xl overflow-hidden">
        {/* Sidebar */}
        <aside className="w-[220px] bg-[#252525] border-r border-gray-800 flex-shrink-0 hidden md:flex md:flex-col">
          <div className="p-6 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">Settings</h2>
          </div>

          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`
                    w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all
                    ${
                      isActive
                        ? 'bg-gray-800/60 text-white border-l-2 border-blue-500'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/30'
                    }
                  `}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-gray-800">
            <p className="text-xs text-gray-500">
              Xantuus AI v1.0.0
            </p>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between p-6 border-b border-gray-800 bg-[#1a1a1a]">
            {/* Mobile Navigation Dropdown */}
            <div className="md:hidden">
              <select
                value={activeSection}
                onChange={(e) => setActiveSection(e.target.value as SectionType)}
                className="bg-[#252525] text-white border border-gray-700 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {navigationItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Section Title (Desktop) */}
            <div className="hidden md:block">
              <h1 className="text-xl font-semibold text-white capitalize">
                {activeSection}
              </h1>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="ml-auto p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
              aria-label="Close settings"
            >
              <X className="w-5 h-5" />
            </button>
          </header>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto bg-[#1a1a1a]">
            <div className="p-6 md:p-8 max-w-4xl">
              {renderSection()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
