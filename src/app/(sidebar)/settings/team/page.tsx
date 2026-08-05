'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { UserPlus, X, Users, Mail, Check } from 'lucide-react';

interface Member {
  userId: string;
  role: string;
  joinedAt: string;
  name: string | null;
  email: string | null;
}

interface PendingInvite {
  token: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

interface IncomingInvite {
  token: string;
  role: string;
  inviter: { id: string; name: string | null; email: string | null } | null;
  expiresAt: string;
}

interface TeamOwnerStatus {
  success: true;
  role: 'owner';
  workspaceId: string;
  plan: string;
  monthlyCredits: number;
  creditsUsed: number;
  canManageMembers: boolean;
  members: Member[];
  pendingInvites: PendingInvite[];
  incomingInvites: IncomingInvite[];
}

interface TeamMemberStatus {
  success: true;
  role: 'member';
  owner: { id: string; name: string | null; email: string | null };
  incomingInvites: IncomingInvite[];
}

type TeamStatus = TeamOwnerStatus | TeamMemberStatus;

const ROLES = [
  { value: 'member', label: 'Member — can use the shared pool' },
  { value: 'admin', label: 'Admin — can also invite/remove members' },
  { value: 'viewer', label: 'Viewer — read-only, cannot use credits' },
];

function TeamPageContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<TeamStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [isInviting, setIsInviting] = useState(false);
  const [manualAcceptUrl, setManualAcceptUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyToken, setBusyToken] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/workspace/team');
      const data = await response.json();
      if (response.ok) {
        setStatus(data);
      } else {
        setError(data.error || 'Failed to load team');
      }
    } catch {
      setError('Failed to load team');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // If arriving via an emailed invite link (?invite=<token>), surface it
  // immediately even before the general fetch above resolves.
  const linkedInviteToken = searchParams.get('invite');

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setManualAcceptUrl(null);
    setIsInviting(true);

    try {
      const response = await fetch('/api/workspace/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to invite team member');
        return;
      }

      if (!data.emailSent && data.acceptUrl) {
        setManualAcceptUrl(data.acceptUrl);
      }

      setInviteEmail('');
      setInviteRole('member');
      await fetchStatus();
    } catch {
      setError('Failed to invite team member');
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (userId: string) => {
    setBusyToken(userId);
    setError(null);
    try {
      const response = await fetch(`/api/workspace/team/${userId}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to remove team member');
        return;
      }
      await fetchStatus();
    } catch {
      setError('Failed to remove team member');
    } finally {
      setBusyToken(null);
    }
  };

  const handleRevoke = async (token: string) => {
    setBusyToken(token);
    setError(null);
    try {
      const response = await fetch(`/api/workspace/team/invites/${token}`, { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to revoke invite');
        return;
      }
      await fetchStatus();
    } catch {
      setError('Failed to revoke invite');
    } finally {
      setBusyToken(null);
    }
  };

  const handleAccept = async (token: string) => {
    setBusyToken(token);
    setError(null);
    try {
      const response = await fetch(`/api/workspace/team/invites/${token}/accept`, { method: 'POST' });
      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to accept invite');
        return;
      }
      router.replace('/settings/team');
      await fetchStatus();
    } catch {
      setError('Failed to accept invite');
    } finally {
      setBusyToken(null);
    }
  };

  if (!session) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-gray-600 dark:text-gray-400">
            Please sign in to view your team.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-gray-600 dark:text-gray-400">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  const incomingInvites = status?.incomingInvites || [];

  const IncomingInvitesBanner = incomingInvites.length > 0 && (
    <Card className="border-blue-200 dark:border-blue-800">
      <CardContent className="py-4 space-y-3">
        {incomingInvites.map((invite) => (
          <div
            key={invite.token}
            className={`flex items-center justify-between gap-3 rounded-lg p-3 ${
              linkedInviteToken === invite.token ? 'bg-blue-50 dark:bg-blue-900/20' : ''
            }`}
          >
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-blue-500 flex-shrink-0" />
              <p className="text-sm text-gray-900 dark:text-white">
                <strong>{invite.inviter?.name || invite.inviter?.email}</strong> invited you to join their team as a{' '}
                <strong>{invite.role}</strong>
              </p>
            </div>
            <button
              onClick={() => handleAccept(invite.token)}
              disabled={busyToken === invite.token}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors flex-shrink-0"
            >
              <Check className="w-4 h-4" />
              {busyToken === invite.token ? 'Accepting...' : 'Accept'}
            </button>
          </div>
        ))}
      </CardContent>
    </Card>
  );

  if (status?.role === 'member') {
    return (
      <div className="space-y-6">
        {IncomingInvitesBanner}
        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <CardDescription>You're part of a shared team credit pool</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <Users className="w-8 h-8 text-blue-500" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  You're on {status.owner.name || status.owner.email}'s team
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Your usage draws from their shared credit pool, not a separate plan of your own.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {IncomingInvitesBanner}

      <Card>
        <CardHeader>
          <CardTitle>Team</CardTitle>
          <CardDescription>
            Invite teammates to share your credit pool. Everyone you invite draws from your plan — one bill, one pool.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {status && (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 p-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Shared pool</p>
                <p className="font-semibold text-gray-900 dark:text-white">
                  {(status.monthlyCredits - status.creditsUsed).toLocaleString()} / {status.monthlyCredits.toLocaleString()} credits remaining
                </p>
              </div>
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">
                {status.plan.toUpperCase()}
              </Badge>
            </div>
          )}

          {status?.canManageMembers && (
            <form onSubmit={handleInvite} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@company.com"
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.value}</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  {isInviting ? 'Inviting...' : 'Invite'}
                </button>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {ROLES.find((r) => r.value === inviteRole)?.label}. They don't need an existing account — if they don't have one, the invite waits until they sign up with this email.
              </p>
            </form>
          )}

          {manualAcceptUrl && (
            <div className="text-sm bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 text-yellow-800 dark:text-yellow-200">
              Email delivery isn't configured yet — share this link with them directly:
              <div className="mt-1 font-mono text-xs break-all">{manualAcceptUrl}</div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>{status?.members.length || 0} teammate(s) sharing your pool</CardDescription>
        </CardHeader>
        <CardContent>
          {!status?.members.length ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              No teammates yet — invite someone above.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {status.members.map((member) => (
                <li key={member.userId} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {member.name || member.email}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {member.email} · {member.role}
                    </p>
                  </div>
                  {status.canManageMembers && (
                    <button
                      onClick={() => handleRemove(member.userId)}
                      disabled={busyToken === member.userId}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      {busyToken === member.userId ? 'Removing...' : 'Remove'}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {!!status?.pendingInvites.length && (
        <Card>
          <CardHeader>
            <CardTitle>Pending Invites</CardTitle>
            <CardDescription>Sent but not yet accepted</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {status.pendingInvites.map((invite) => (
                <li key={invite.token} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{invite.email}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Invited as {invite.role} · expires {new Date(invite.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleRevoke(invite.token)}
                    disabled={busyToken === invite.token}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    {busyToken === invite.token ? 'Revoking...' : 'Revoke'}
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function TeamPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <TeamPageContent />
    </Suspense>
  );
}
