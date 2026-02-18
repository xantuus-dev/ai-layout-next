'use client';

import React, { useState } from 'react';
import { X, Search } from 'lucide-react';

// Types
interface App {
  id: string;
  icon: string;
  title: string;
  description: string;
}

// Featured Integration Card Component
interface FeaturedCardProps {
  icon: string;
  title: string;
  description: string;
  onConnect: () => void;
  onClose: () => void;
}

const FeaturedCard: React.FC<FeaturedCardProps> = ({ 
  icon, 
  title, 
  description, 
  onConnect, 
  onClose 
}) => (
  <div className="px-6 pb-4 relative group">
    <button
      type="button"
      aria-label="Close"
      onClick={onClose}
      className="absolute top-[-8px] end-[16px] z-10 flex items-center justify-center size-5 rounded-full border border-[var(--border-btn-main)] bg-[var(--background-menu-white)] hover:bg-[var(--background-nav)] opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition duration-150 cursor-pointer"
    >
      <X size={12} strokeWidth={2.4} className="text-[var(--icon-tertiary)]" />
    </button>
    
    <div className="flex items-center gap-6 px-4 py-3 min-h-[76px] bg-[var(--background-menu-white)] rounded-[12px] border border-[var(--border-main)]">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex items-center justify-center size-10 bg-[var(--background-menu-white)] rounded-lg border border-[var(--border-main)] shrink-0">
          <img alt={title} src={icon} style={{ width: 24, height: 24 }} />
        </div>
        
        <div className="flex flex-col gap-[2px] flex-1 min-w-0">
          <div className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] tracking-[-0.154px] truncate">
            {title}
          </div>
          <div className="text-[12px] font-normal leading-[16px] text-[var(--text-tertiary)] truncate">
            {description}
          </div>
        </div>
      </div>
      
      <button
        onClick={onConnect}
        className="inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors hover:opacity-90 active:opacity-80 h-[36px] min-w-[72px] px-[12px] gap-[6px] outline outline-1 -outline-offset-1 text-[var(--text-primary)] rounded-[8px] bg-[var(--Button-primary-white)] outline-[var(--border-btn-main)] text-[14px] leading-[20px] tracking-[-0.154px] hover:bg-[var(--fill-gray)]"
      >
        Connect
      </button>
    </div>
  </div>
);

// Tab Component
interface TabsProps {
  tabs: string[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange }) => (
  <div className="border-[var(--border-main)] flex items-center bg-transparent border-0 rounded-none h-[44px] p-0 gap-[8px] w-max">
    {tabs.map((tab) => (
      <li key={tab} className="relative list-none flex items-center h-[44px]">
        <button
          onClick={() => onTabChange(tab)}
          className="data-[active]:text-[var(--text-primary)] data-[active]:font-[500] transition-colors duration-200 relative z-10 min-w-[42px] px-[8px] py-[12px] text-[14px] leading-[20px] font-[500] tracking-[-0.154px] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          data-active={activeTab === tab ? '' : undefined}
        >
          {tab}
        </button>
        {activeTab === tab && (
          <div className="absolute inset-0 bg-transparent shadow-none rounded-none border-b-[2px] border-[var(--Button-primary-black)]" />
        )}
      </li>
    ))}
  </div>
);

// Search Input Component
interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
}

const SearchInput: React.FC<SearchInputProps> = ({ value, onChange, onClear }) => (
  <div className="group overflow-hidden text-[var(--text-primary)] placeholder:text-[var(--text-disable)] flex items-center bg-[var(--fill-tsp-white-main)] focus-within:ring-[1px] focus-within:ring-[var(--border-dark)] w-full sm:w-[200px] h-9 sm:h-[32px] rounded-[8px] px-[12px] py-[6px] sm:py-[4px] gap-[6px] text-[13px] leading-[18px] tracking-[-0.091px]">
    <Search size={16} className="text-[var(--icon-secondary)]" strokeWidth={2} />
    <input
      aria-label="Search"
      placeholder="Search"
      className="h-full min-w-1 flex-1 bg-transparent disabled:cursor-not-allowed placeholder:text-[var(--text-disable)] outline-none"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
    {value && (
      <X
        size={16}
        className="cursor-pointer opacity-0 hover:opacity-90 group-hover:opacity-100 group-focus-within:opacity-100 text-[var(--icon-tertiary)]"
        onClick={onClear}
      />
    )}
  </div>
);

// App Card Component
interface AppCardProps {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}

const AppCard: React.FC<AppCardProps> = ({ icon, title, description, onClick }) => (
  <div
    onClick={onClick}
    className="flex items-center gap-3 px-4 py-3 min-h-[76px] bg-[var(--background-menu-white)] rounded-[12px] border border-[var(--border-main)] cursor-pointer hover:bg-[var(--fill-tsp-white-light)] transition-colors"
  >
    <div className="flex items-center justify-center size-10 bg-[var(--background-menu-white)] rounded-lg border border-[var(--border-main)] shrink-0">
      <img alt={title} src={icon} style={{ width: 24, height: 24 }} />
    </div>
    
    <div className="flex flex-col items-start justify-center min-w-0 flex-1">
      <div className="w-full overflow-hidden">
        <div className="text-[14px] font-medium leading-[20px] text-[var(--text-primary)] tracking-[-0.154px] truncate">
          {title}
        </div>
      </div>
      <div className="w-full overflow-hidden">
        <div className="text-[12px] font-normal leading-[16px] text-[var(--text-tertiary)] tracking-[-0.091px] line-clamp-2">
          {description}
        </div>
      </div>
    </div>
  </div>
);

// Main Integration Panel Component
export const IntegrationPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('Apps');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFeatured, setShowFeatured] = useState(true);

  const apps: App[] = [
    {
      id: 'my-browser',
      icon: 'https://d1oupeiobkpcny.cloudfront.net/assets/dashboard/materials/2025/10/27/a4a2c85210889e964361c636ded2df04ead5e0ceccc9f66017dfe0302b0c1f38.webp',
      title: 'My Browser',
      description: 'Access the web on your own browser'
    },
    {
      id: 'gmail',
      icon: 'https://d1oupeiobkpcny.cloudfront.net/assets/dashboard/materials/2025/08/29/67030616adb5e0ee57ead43394db33e557c56158e0047655fd695f353a9454ae.webp',
      title: 'Gmail',
      description: 'Draft replies, search your inbox, and summarize email threads instantly'
    },
    {
      id: 'google-calendar',
      icon: 'https://d1oupeiobkpcny.cloudfront.net/assets/dashboard/materials/2025/08/29/4ea9c5a92002d43fa460de537cd79c9f325d6aa22c4a82a7ba4cf6f50dd3303a.webp',
      title: 'Google Calendar',
      description: 'Understand your schedule, manage events, and optimize your time effectively'
    },
    {
      id: 'google-drive',
      icon: 'https://d1oupeiobkpcny.cloudfront.net/assets/dashboard/materials/2025/11/20/e1b2e58265cb7a57264764d6184467e67b69e83e424cae854a9bb93ac5ddc6c2.webp',
      title: 'Google Drive',
      description: 'Access your files, search instantly, and let Manus help you manage documents intelligently'
    },
    {
      id: 'github',
      icon: 'https://d1oupeiobkpcny.cloudfront.net/assets/dashboard/materials/2025/08/29/929f4a07401e2208f3ed494ad8268fd86e5c8091080ab3c2aabf5b2eeac88eba.webp',
      title: 'GitHub',
      description: 'Manage repositories, track code changes, and collaborate on team projects'
    },
    {
      id: 'slack',
      icon: 'https://files.manuscdn.com/assets/image/slack.png',
      title: 'Slack',
      description: 'Read and write Slack conversations in Manus'
    },
    {
      id: 'notion',
      icon: 'https://d1oupeiobkpcny.cloudfront.net/assets/dashboard/materials/2025/08/29/dafefc2ce61fde1fb5310d4542403bc866bfa70c931d8b2ff3d9f8788fd6cfcf.webp',
      title: 'Notion',
      description: 'Search workspace content, update notes, and automate workflows in Notion'
    },
    {
      id: 'linear',
      icon: 'https://d1oupeiobkpcny.cloudfront.net/assets/dashboard/materials/2025/08/29/27837739253d7306aedc06a7014c4414dc493b49a8c298d47018af0bb447de27.webp',
      title: 'Linear',
      description: 'Track issues, manage projects, and organize workflows across your team'
    }
  ];

  const filteredApps = apps.filter(app =>
    app.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden -mt-[6px] pt-[8px]">
      {showFeatured && (
        <FeaturedCard
          icon="https://d1oupeiobkpcny.cloudfront.net/assets/dashboard/materials/2025/10/27/a4a2c85210889e964361c636ded2df04ead5e0ceccc9f66017dfe0302b0c1f38.webp"
          title="My Browser"
          description="Let Manus access your personalized context and perform tasks directly in your browser."
          onConnect={() => console.log('Connect clicked')}
          onClose={() => setShowFeatured(false)}
        />
      )}
      
      <div className="px-4 sm:px-[24px]">
        <div className="flex flex-col gap-2 py-2 sm:py-0 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--border-main)]">
          <div className="w-full sm:w-auto">
            <Tabs
              tabs={['Apps', 'Custom API', 'Custom MCP']}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>
          
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery('')}
          />
        </div>
      </div>
      
      <div className="flex-1 h-0 min-h-0 overflow-auto p-6 custom-scrollbar">
        <div className="grid gap-3 md:grid-cols-2 justify-center pb-6">
          {filteredApps.map((app) => (
            <AppCard
              key={app.id}
              {...app}
              onClick={() => console.log(`${app.title} clicked`)}
            />
          ))}
        </div>
        
        <div className="text-center text-[14px] leading-[20px] text-[var(--text-tertiary)] pb-6">
          Can&apos;t find what you&apos;re looking for?{' '}
          <a 
            href="/feedback?issueType=CONNECTOR&secondaryType=NEED_MORE" 
            className="underline hover:text-[var(--text-primary)] transition-colors" 
            target="_blank" 
            rel="noopener noreferrer"
          >
            Let us know!
          </a>
        </div>
      </div>
    </div>
  );
};

export default IntegrationPanel;
