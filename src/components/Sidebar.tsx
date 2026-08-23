'use client';

/**
 * Sidebar Component
 *
 * Responsive sidebar navigation with:
 * - Mobile hamburger menu
 * - Desktop collapse functionality
 * - A collapsible "Sessions" list (recent conversations across all workspaces)
 * - Gradient styling matching app theme
 */

import React, { useState, useEffect } from 'react';
import {
  Menu,
  X,
  LayoutDashboard,
  User,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Home,
  BarChart3,
  Sparkles,
  FolderOpen,
  Link2,
  Wand2,
  ChevronDown,
  MessageSquare,
  SquarePen,
  FileStack,
  Clapperboard,
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

interface MenuItem {
  name: string;
  icon: React.ElementType;
  href: string;
  requireAuth?: boolean;
}

interface SessionSummary {
  id: string;
  title: string;
  workspace: { id: string; name: string } | null;
}

interface SidebarProps {
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function Sidebar({ isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [sessionsExpanded, setSessionsExpanded] = useState(true);
  const [conversations, setConversations] = useState<SessionSummary[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  const menuItems: MenuItem[] = [
    { name: 'Home', icon: Home, href: '/' },
    { name: 'Dashboard', icon: LayoutDashboard, href: '/workspace', requireAuth: true },
    { name: 'Templates', icon: Sparkles, href: '/templates' },
    { name: 'Image Generator', icon: Wand2, href: '/apps/image-generator', requireAuth: true },
    { name: 'Video Generator', icon: Clapperboard, href: '/apps/video-generator', requireAuth: true },
    { name: 'Documents', icon: FileStack, href: '/documents/new', requireAuth: true },
    { name: 'Projects', icon: FolderOpen, href: '/workspace/projects/new', requireAuth: true },
    { name: 'Browser', icon: Link2, href: '/browser', requireAuth: true },
    { name: 'Analytics', icon: BarChart3, href: '/settings/usage', requireAuth: true },
    { name: 'Settings', icon: Settings, href: '/settings/account', requireAuth: true },
  ];

  const toggleSidebar = () => setIsOpen(!isOpen);

  const handleNavigation = (item: MenuItem) => {
    router.push(item.href);
    if (isOpen) {
      setIsOpen(false);
    }
  };

  const handleLogout = () => {
    signOut({ callbackUrl: '/' });
  };

  const handleNewChat = () => {
    router.push('/');
    if (isOpen) setIsOpen(false);
  };

  const handleSessionClick = (conv: SessionSummary) => {
    if (!conv.workspace) return;
    router.push(`/workspace/${conv.workspace.id}?conversation=${conv.id}`);
    if (isOpen) setIsOpen(false);
  };

  // Filter menu items based on auth status
  const visibleMenuItems = menuItems.filter(
    (item) => !item.requireAuth || session
  );

  // The single active nav item. Exact match wins; otherwise the item whose href
  // is the LONGEST path-prefix of the current route. Without the "most specific"
  // rule, a parent route (/workspace) also matches a child
  // (/workspace/projects/new), so two items highlight at once and their icons
  // read as obscured. Now only the deepest match is active.
  const activeHref = (() => {
    const matches = visibleMenuItems.filter((item) =>
      item.href === '/'
        ? pathname === '/'
        : pathname === item.href || pathname?.startsWith(`${item.href}/`)
    );
    if (matches.length === 0) return null;
    return matches.reduce((best, item) =>
      item.href.length > best.href.length ? item : best
    ).href;
  })();

  // Load recent sessions (across all workspaces) — refetches when navigating
  // into/out of a workspace so a freshly created session shows up.
  useEffect(() => {
    if (!session?.user) {
      setConversations([]);
      return;
    }

    let cancelled = false;
    setLoadingConversations(true);

    fetch('/api/workspace/conversations?limit=20&sortBy=lastMessageAt&sortOrder=desc')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setConversations(data.conversations || []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingConversations(false);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user, pathname]);

  return (
    <>
      {/* Mobile Hamburger Button */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[#1a1a1a] text-white hover:bg-[#252525] transition-colors duration-200 shadow-lg border border-gray-800"
        aria-label="Toggle sidebar"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30 transition-opacity duration-300"
          onClick={toggleSidebar}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full flex flex-col bg-gradient-to-b from-[#1a1a1a] via-[#252525] to-[#1a1a1a] border-r border-gray-800 transition-all duration-300 ease-in-out z-40 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } w-64 shadow-2xl`}
      >
        {/* Header */}
        {/* Padding tightens when collapsed: at lg:w-20 the full p-6 leaves only
            32px of content box, which is not enough for the mark and the toggle
            side by side and silently crushes the mark to a sliver. */}
        <div
          className={`flex items-center justify-between border-b border-gray-800 flex-shrink-0 ${
            isCollapsed ? 'px-3 py-6 gap-1' : 'px-6 py-4 gap-2'
          }`}
        >
          {/* Expanded: the full wordmark. Collapsed: the X mark alone, since the
              wordmark would be illegible in the narrow rail. The sidebar
              background is dark in both themes, so the white variant is always
              correct here. */}
          {isCollapsed ? (
            <img
              src="/xantuus-icon-white.png"
              alt="Xantuus AI"
              className="w-7 h-7 object-contain flex-shrink-0"
            />
          ) : (
            /* Full X + wordmark lockup, grey monochrome variant
               (xantuus-logo-grey.png = the 3281×1875 lockup trimmed to its
               content band and recoloured to a light grey, aspect ~3.45).
               Sized by WIDTH, not height: the art is mostly horizontal, so a
               height constraint under-renders it. 170px wide keeps the mark +
               text legible and still leaves room for the toggle. object-left
               anchors it against the padding. */
            <img
              src="/xantuus-logo-grey.png"
              alt="Xantuus AI"
              className="w-[170px] max-w-full h-auto object-contain object-left"
            />
          )}

          {/* Desktop Collapse Button */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:block flex-shrink-0 p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors duration-200"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
        </div>

        {/* New Chat (always first, always available) */}
        <div className="px-4 pt-4 flex-shrink-0">
          <button
            onClick={handleNewChat}
            className={`w-full flex items-center space-x-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-colors duration-200 ${
              isCollapsed ? 'justify-center px-0 py-2.5' : 'px-4 py-2.5'
            }`}
          >
            <SquarePen size={18} className="text-primary flex-shrink-0" />
            {!isCollapsed && <span className="text-[15px] font-medium">New chat</span>}
          </button>
        </div>

        {/* Primary Navigation (fixed, does not scroll) */}
        <nav className="p-4 space-y-1 flex-shrink-0">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === activeHref;

            return (
              <button
                key={item.name}
                onClick={() => handleNavigation(item)}
                className={`relative w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-gray-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-full bg-primary" />
                )}
                <Icon
                  size={18}
                  className={`transition-colors duration-200 ${
                    isActive ? 'text-primary' : 'text-gray-400 group-hover:text-white'
                  }`}
                />
                {!isCollapsed && (
                  <span className="text-[15px] font-medium transition-colors duration-200">
                    {item.name}
                  </span>
                )}
              </button>
            );
          })}

          {/* Logout Button */}
          {session && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg transition-all duration-200 group text-gray-300 hover:bg-red-600/20 hover:text-red-400 border-t border-gray-800 mt-2 pt-3"
            >
              <LogOut
                size={18}
                className="text-gray-400 group-hover:text-red-400 transition-colors duration-200"
              />
              {!isCollapsed && (
                <span className="text-[15px] font-medium transition-colors duration-200">
                  Logout
                </span>
              )}
            </button>
          )}
        </nav>

        {/* Sessions (collapsible, fills remaining space, own scroll region) */}
        {session && !isCollapsed && (
          <div className="flex flex-col flex-1 min-h-0 border-t border-gray-800 mt-2">
            <button
              onClick={() => setSessionsExpanded((prev) => !prev)}
              className="w-full flex items-center justify-between px-5 py-3 text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
            >
              <span>Sessions</span>
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${sessionsExpanded ? '' : '-rotate-90'}`}
              />
            </button>

            {sessionsExpanded && (
              <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-2 space-y-0.5">
                {loadingConversations ? (
                  <p className="px-3 py-2 text-xs text-gray-500">Loading...</p>
                ) : conversations.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-500">No sessions yet</p>
                ) : (
                  conversations.map((conv) => {
                    const isActiveSession = pathname === `/workspace/${conv.workspace?.id}`;
                    return (
                      <button
                        key={conv.id}
                        onClick={() => handleSessionClick(conv)}
                        title={conv.title}
                        className={`w-full flex items-center gap-2 text-left px-3 py-2 rounded-lg text-[15px] truncate transition-colors ${
                          isActiveSession
                            ? 'bg-white/10 text-white'
                            : 'text-gray-400 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <MessageSquare size={14} className="flex-shrink-0 text-gray-500" />
                        <span className="truncate">{conv.title || 'Untitled session'}</span>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        {!isCollapsed && session && (
          <div className="p-4 border-t border-gray-800 flex-shrink-0">
            <div className="flex items-center space-x-3 px-4 py-3">
              <div className="w-8 h-8 bg-gradient-to-r from-teal-400 to-emerald-500 rounded-full flex items-center justify-center">
                {session.user?.image ? (
                  <img
                    src={session.user.image}
                    alt={session.user.name || 'User'}
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <span className="text-white font-semibold text-sm">
                    {session.user?.name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {session.user?.name || 'User'}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {session.user?.email}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
