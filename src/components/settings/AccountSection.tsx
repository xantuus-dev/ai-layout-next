'use client';

/**
 * Account Section
 *
 * Account information and profile settings
 */

import { useSession } from 'next-auth/react';
import { User, Mail, Calendar, Shield } from 'lucide-react';

export function AccountSection() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-white mb-2">Account</h2>
        <p className="text-sm text-gray-400">
          View and manage your account information
        </p>
      </div>

      {/* Profile Card */}
      <div className="bg-[#252525] border border-gray-800 rounded-lg p-6">
        <div className="flex items-center gap-4 mb-6">
          {user?.image ? (
            <img
              src={user.image}
              alt={user.name || 'User'}
              className="w-20 h-20 rounded-full border-2 border-gray-700"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-2xl">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <div>
            <h3 className="text-xl font-semibold text-white">{user?.name || 'User'}</h3>
            <p className="text-sm text-gray-400">{user?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Name */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <User className="w-4 h-4" />
              <span>Full Name</span>
            </div>
            <p className="text-gray-200 pl-6">{user?.name || 'Not set'}</p>
          </div>

          {/* Email */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Mail className="w-4 h-4" />
              <span>Email Address</span>
            </div>
            <p className="text-gray-200 pl-6">{user?.email || 'Not set'}</p>
          </div>

          {/* Account Created */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Calendar className="w-4 h-4" />
              <span>Member Since</span>
            </div>
            <p className="text-gray-200 pl-6">
              {new Date().toLocaleDateString('en-US', {
                month: 'long',
                year: 'numeric'
              })}
            </p>
          </div>

          {/* Account Type */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Shield className="w-4 h-4" />
              <span>Account Type</span>
            </div>
            <p className="text-gray-200 pl-6">Standard</p>
          </div>
        </div>
      </div>

      {/* Provider Information */}
      <div className="bg-[#252525] border border-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Authentication Provider</h3>
        <div className="flex items-center gap-3 p-4 bg-[#1a1a1a] border border-gray-800 rounded-lg">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
            <span className="text-xl">G</span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-200">Google</p>
            <p className="text-xs text-gray-500">Signed in with Google OAuth</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-4">
          Your account is managed by your OAuth provider. Profile changes should be made through your provider's settings.
        </p>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-red-400 mb-2">Danger Zone</h3>
        <p className="text-sm text-gray-400 mb-4">
          These actions are permanent and cannot be undone.
        </p>
        <button
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
          onClick={() => {
            if (confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
              // Handle account deletion
            }
          }}
        >
          Delete Account
        </button>
      </div>
    </div>
  );
}
