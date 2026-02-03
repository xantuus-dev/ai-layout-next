'use client';

/**
 * Settings Section
 *
 * General application settings and preferences
 */

import { useState } from 'react';
import { Moon, Sun, Bell, Globe, Lock } from 'lucide-react';
import { Label } from '@/components/ui/label';

export function SettingsSection() {
  const [notifications, setNotifications] = useState(true);
  const [emailUpdates, setEmailUpdates] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-2">Settings</h2>
        <p className="text-sm text-gray-400">
          Manage your application preferences and settings
        </p>
      </div>

      {/* Appearance */}
      <div className="bg-[#252525] border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          {darkMode ? <Moon className="w-5 h-5 text-blue-400" /> : <Sun className="w-5 h-5 text-yellow-400" />}
          <h3 className="text-lg font-semibold text-white">Appearance</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-200">Dark Mode</Label>
              <p className="text-xs text-gray-500">Use dark theme across the application</p>
            </div>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                darkMode ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  darkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-[#252525] border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Bell className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Notifications</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-200">Push Notifications</Label>
              <p className="text-xs text-gray-500">Receive notifications in your browser</p>
            </div>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                notifications ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-gray-200">Email Updates</Label>
              <p className="text-xs text-gray-500">Receive updates and news via email</p>
            </div>
            <button
              onClick={() => setEmailUpdates(!emailUpdates)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                emailUpdates ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  emailUpdates ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Language & Region */}
      <div className="bg-[#252525] border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Globe className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Language & Region</h3>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-gray-200 mb-2 block">Language</Label>
            <select className="w-full bg-[#1a1a1a] border border-gray-700 text-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>English (US)</option>
              <option>English (UK)</option>
              <option>Spanish</option>
              <option>French</option>
              <option>German</option>
            </select>
          </div>

          <div>
            <Label className="text-gray-200 mb-2 block">Timezone</Label>
            <select className="w-full bg-[#1a1a1a] border border-gray-700 text-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option>UTC (GMT+0)</option>
              <option>EST (GMT-5)</option>
              <option>PST (GMT-8)</option>
              <option>CET (GMT+1)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Privacy & Security */}
      <div className="bg-[#252525] border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Lock className="w-5 h-5 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Privacy & Security</h3>
        </div>

        <div className="space-y-3">
          <button className="w-full text-left px-4 py-3 bg-[#1a1a1a] border border-gray-800 rounded-lg text-sm text-gray-200 hover:bg-[#2a2a2a] transition-colors">
            Manage Data & Privacy
          </button>
          <button className="w-full text-left px-4 py-3 bg-[#1a1a1a] border border-gray-800 rounded-lg text-sm text-gray-200 hover:bg-[#2a2a2a] transition-colors">
            Two-Factor Authentication
          </button>
          <button className="w-full text-left px-4 py-3 bg-[#1a1a1a] border border-gray-800 rounded-lg text-sm text-gray-200 hover:bg-[#2a2a2a] transition-colors">
            Active Sessions
          </button>
        </div>
      </div>
    </div>
  );
}
