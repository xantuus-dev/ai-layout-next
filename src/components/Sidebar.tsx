'use client';

/**
 * Sidebar Component
 *
 * Responsive sidebar navigation with:
 * - Mobile hamburger menu
 * - Desktop collapse functionality
 * - Gradient styling matching app theme
 */

import React, { useState } from 'react';
import {
  Menu,
  X,
  LayoutDashboard,
  User,
  Settings,
  LogOut,
  ChevronLeft,
  Home,
  BarChart3,
  Sparkles,
  FolderOpen,
  Link2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';

interface MenuItem {
  name: string;
  icon: React.ElementType;
  href: string;
  requireAuth?: boolean;
}

export default function Sidebar() {
  const router = useRouter();
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeItem, setActiveItem] = useState('Home');

  const menuItems: MenuItem[] = [
    { name: 'Home', icon: Home, href: '/' },
    { name: 'Dashboard', icon: LayoutDashboard, href: '/workspace', requireAuth: true },
    { name: 'Templates', icon: Sparkles, href: '/templates' },
    { name: 'Projects', icon: FolderOpen, href: '/workspace/projects/new', requireAuth: true },
    { name: 'Browser', icon: Link2, href: '/browser', requireAuth: true },
    { name: 'Analytics', icon: BarChart3, href: '/settings/usage', requireAuth: true },
    { name: 'Settings', icon: Settings, href: '/settings/account', requireAuth: true },
  ];

  const toggleSidebar = () => setIsOpen(!isOpen);
  const toggleCollapse = () => setIsCollapsed(!isCollapsed);

  const handleNavigation = (item: MenuItem) => {
    setActiveItem(item.name);
    router.push(item.href);
    if (isOpen) {
      setIsOpen(false);
    }
  };

  const handleLogout = () => {
    signOut({ callbackUrl: '/' });
  };

  // Filter menu items based on auth status
  const visibleMenuItems = menuItems.filter(
    (item) => !item.requireAuth || session
  );

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
        className={`fixed top-0 left-0 h-full bg-gradient-to-b from-[#1a1a1a] via-[#252525] to-[#1a1a1a] border-r border-gray-800 transition-all duration-300 ease-in-out z-40 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 ${
          isCollapsed ? 'lg:w-20' : 'lg:w-64'
        } w-64 shadow-2xl`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">X</span>
            </div>
            {!isCollapsed && (
              <h1 className="text-xl font-bold text-white tracking-wide">
                Xantuus
              </h1>
            )}
          </div>

          {/* Desktop Collapse Button */}
          <button
            onClick={toggleCollapse}
            className="hidden lg:block p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors duration-200"
            aria-label="Toggle collapse"
          >
            <ChevronLeft
              size={20}
              className={`transition-transform duration-300 ${
                isCollapsed ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {visibleMenuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.name;

            return (
              <button
                key={item.name}
                onClick={() => handleNavigation(item)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon
                  size={20}
                  className={`transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'
                  }`}
                />
                {!isCollapsed && (
                  <span className="font-medium transition-colors duration-200">
                    {item.name}
                  </span>
                )}

                {/* Active indicator */}
                {isActive && !isCollapsed && (
                  <div className="ml-auto w-2 h-2 bg-white rounded-full opacity-80" />
                )}
              </button>
            );
          })}

          {/* Logout Button */}
          {session && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 group text-gray-300 hover:bg-red-600/20 hover:text-red-400 border-t border-gray-800 mt-4 pt-4"
            >
              <LogOut
                size={20}
                className="text-gray-400 group-hover:text-red-400 transition-colors duration-200"
              />
              {!isCollapsed && (
                <span className="font-medium transition-colors duration-200">
                  Logout
                </span>
              )}
            </button>
          )}
        </nav>

        {/* Footer */}
        {!isCollapsed && session && (
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center space-x-3 px-4 py-3">
              <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
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
