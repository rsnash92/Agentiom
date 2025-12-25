'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar, Header, BracketCard } from '@/components';
import { useAuth } from '@/lib/auth-context';
import { api, ApiToken } from '@/lib/api';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function SettingsPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const router = useRouter();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTokenName, setNewTokenName] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchTokens = async () => {
    try {
      const { tokens } = await api.listTokens();
      setTokens(tokens);
    } catch (error) {
      console.error('Failed to fetch tokens:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchTokens();
    }
  }, [user]);

  const handleCreateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenName.trim()) return;

    setCreating(true);
    try {
      const { token } = await api.createToken(newTokenName.trim());
      // The full token is only shown once
      setNewToken((token as unknown as { token: string }).token || token.prefix + '...');
      setNewTokenName('');
      await fetchTokens();
    } catch (error) {
      console.error('Failed to create token:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    if (!confirm('Are you sure you want to revoke this token? This cannot be undone.')) {
      return;
    }

    try {
      await api.revokeToken(tokenId);
      await fetchTokens();
    } catch (error) {
      console.error('Failed to revoke token:', error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-56 p-8">
        <Header
          title="Settings"
          subtitle="Manage your account and API tokens"
        />

        <div className="space-y-6">
          {/* Account */}
          <BracketCard>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Account</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Email</span>
                <span className="text-gray-900">{user.email}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Member since</span>
                <span className="text-gray-900">{formatDate(user.createdAt)}</span>
              </div>
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={logout}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  Sign out
                </button>
              </div>
            </div>
          </BracketCard>

          {/* API Tokens */}
          <BracketCard>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">API Tokens</h2>
            <p className="text-sm text-gray-500 mb-4">
              Use API tokens to authenticate with the CLI or API.
            </p>

            {/* New token form */}
            <form onSubmit={handleCreateToken} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
                placeholder="Token name (e.g., laptop-cli)"
                className="flex-1 px-3 py-2 border border-gray-300 text-sm focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                disabled={creating || !newTokenName.trim()}
                className="px-4 py-2 bg-primary text-white text-sm hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Token'}
              </button>
            </form>

            {/* Show new token */}
            {newToken && (
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded mb-4">
                <p className="text-sm text-emerald-800 font-medium mb-2">
                  Token created! Copy it now - you won&apos;t be able to see it again.
                </p>
                <code className="block bg-white px-3 py-2 text-sm font-mono break-all border border-emerald-200">
                  {newToken}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(newToken);
                  }}
                  className="mt-2 text-xs text-emerald-700 hover:underline"
                >
                  Copy to clipboard
                </button>
              </div>
            )}

            {/* Token list */}
            {loading ? (
              <div className="text-center py-4 text-gray-500 text-sm">Loading tokens...</div>
            ) : tokens.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                No API tokens yet. Create one to use the CLI.
              </div>
            ) : (
              <div className="border border-gray-200 rounded divide-y divide-gray-200">
                {tokens.map((token) => (
                  <div key={token.id} className="flex items-center justify-between p-3">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{token.name}</p>
                      <p className="text-xs text-gray-500">
                        <code className="bg-gray-100 px-1 rounded">{token.prefix}...</code>
                        {' · '}
                        Created {formatDate(token.createdAt)}
                        {token.lastUsedAt && ` · Last used ${formatDate(token.lastUsedAt)}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevokeToken(token.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </BracketCard>
        </div>
      </main>
    </div>
  );
}
