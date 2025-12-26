'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Sidebar,
  Header,
  BracketCard,
  StatCard,
  CommandCard,
  AgentRow,
  EmptyState,
  LandingPage,
} from '@/components';
import { useAuth } from '@/lib/auth-context';
import { api, Agent } from '@/lib/api';

const quickStartCommands = [
  { command: 'npm install -g @agentiom/cli', description: 'Install the CLI globally' },
  { command: 'agentiom init my-agent', description: 'Create a new agent project' },
  { command: 'agentiom deploy', description: 'Deploy to the cloud' },
];

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

function mapStatus(status: Agent['status']): 'running' | 'stopped' | 'error' {
  switch (status) {
    case 'running':
      return 'running';
    case 'failed':
      return 'error';
    default:
      return 'stopped';
  }
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [isMainDomain, setIsMainDomain] = useState(false);

  useEffect(() => {
    // Check if we're on the main marketing domain (agentiom.com) vs app subdomain (app.agentiom.com)
    const hostname = window.location.hostname;
    const isMain = hostname === 'agentiom.com' || hostname === 'www.agentiom.com' || hostname === 'localhost';
    setIsMainDomain(isMain);
  }, []);

  useEffect(() => {
    if (user) {
      api.listAgents()
        .then(({ agents }) => setAgents(agents))
        .catch(console.error)
        .finally(() => setLoadingAgents(false));
    }
  }, [user]);

  useEffect(() => {
    // Redirect to login on app subdomain if not authenticated
    if (!loading && !user && !isMainDomain) {
      const hostname = window.location.hostname;
      if (hostname.startsWith('app.') || hostname.includes('app.agentiom')) {
        router.push('/login');
      }
    }
  }, [loading, user, isMainDomain, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  // Show landing page for unauthenticated users on main domain
  if (!user) {
    // On app subdomain, show loading while redirecting to login
    if (!isMainDomain) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
          <div className="text-gray-500">Loading...</div>
        </div>
      );
    }
    return <LandingPage />;
  }

  const runningAgents = agents.filter(a => a.status === 'running').length;
  const sleepingAgents = agents.filter(a => a.status === 'sleeping').length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-56 p-8">
        <Header
          title="Dashboard"
          subtitle={`Welcome back, ${user.email}!`}
        />

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Agents" value={agents.length} />
          <StatCard label="Running" value={runningAgents} trend={runningAgents > 0 ? 'up' : 'neutral'} />
          <StatCard label="Sleeping" value={sleepingAgents} trend="neutral" />
          <StatCard label="Failed" value={agents.filter(a => a.status === 'failed').length} trend={agents.filter(a => a.status === 'failed').length > 0 ? 'down' : 'neutral'} />
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Quick Start */}
          <div className="col-span-1">
            <BracketCard>
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Quick Start</h2>
              <div className="space-y-3">
                {quickStartCommands.map((cmd, i) => (
                  <CommandCard key={i} command={cmd.command} description={cmd.description} />
                ))}
              </div>
            </BracketCard>
          </div>

          {/* Recent Agents */}
          <div className="col-span-2">
            <BracketCard>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">Recent Agents</h2>
                <a href="/agents" className="text-xs text-primary hover:underline">View all →</a>
              </div>
              {loadingAgents ? (
                <div className="text-center py-8 text-gray-500 text-sm">Loading agents...</div>
              ) : agents.length === 0 ? (
                <EmptyState
                  title="No agents yet"
                  description="Create your first agent using the CLI"
                  actionLabel="View docs"
                  actionHref="/docs"
                />
              ) : (
                <div className="border border-gray-200 rounded">
                  {agents.slice(0, 5).map((agent) => (
                    <AgentRow
                      key={agent.id}
                      name={agent.name}
                      status={mapStatus(agent.status)}
                      region={agent.region}
                      lastActive={formatTimeAgo(agent.updatedAt)}
                    />
                  ))}
                </div>
              )}
            </BracketCard>
          </div>
        </div>

        {/* Activity placeholder */}
        <div className="mt-6">
          <BracketCard>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
              <a href="/logs" className="text-xs text-primary hover:underline">View logs →</a>
            </div>
            <div className="font-mono text-xs bg-gray-900 text-gray-300 p-4 rounded max-h-48 overflow-y-auto">
              {agents.length === 0 ? (
                <p className="text-gray-500">No activity yet. Deploy an agent to see logs here.</p>
              ) : (
                <div className="space-y-1">
                  <p><span className="text-gray-500">[--:--:--]</span> <span className="text-cyan-400">INFO</span> Activity logs coming soon...</p>
                </div>
              )}
            </div>
          </BracketCard>
        </div>
      </main>
    </div>
  );
}
