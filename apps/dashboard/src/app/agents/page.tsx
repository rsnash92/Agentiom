'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Sidebar, Header, BracketCard, EmptyState } from '@/components';
import { useAuth } from '@/lib/auth-context';
import { api, Agent } from '@/lib/api';

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

interface AgentCardProps {
  agent: Agent;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
  loading: boolean;
}

function AgentCard({ agent, onStart, onStop, onDelete, loading }: AgentCardProps) {
  const statusColors = {
    running: 'bg-emerald-100 text-emerald-700',
    stopped: 'bg-gray-100 text-gray-600',
    pending: 'bg-yellow-100 text-yellow-700',
    deploying: 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700',
    destroyed: 'bg-gray-100 text-gray-500',
  };

  const statusDotColors = {
    running: 'bg-emerald-500',
    stopped: 'bg-gray-400',
    pending: 'bg-yellow-500',
    deploying: 'bg-blue-500 animate-pulse',
    failed: 'bg-red-500',
    destroyed: 'bg-gray-400',
  };

  return (
    <div className="bg-white border border-gray-200 p-4 hover:border-primary transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${statusDotColors[agent.status]}`} />
          <Link href={`/agents/${agent.id}`} className="font-medium text-gray-900 hover:text-primary">
            {agent.name}
          </Link>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded ${statusColors[agent.status]}`}>
          {agent.status}
        </span>
      </div>

      {agent.description && (
        <p className="text-sm text-gray-500 mb-3">{agent.description}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-gray-400 mb-4">
        <span>Region: {agent.region}</span>
        <span>Updated: {formatTimeAgo(agent.updatedAt)}</span>
      </div>

      {agent.endpoint && (
        <div className="mb-4">
          <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 break-all">
            {agent.endpoint}
          </code>
        </div>
      )}

      <div className="flex items-center gap-2">
        {agent.status === 'stopped' && (
          <button
            onClick={onStart}
            disabled={loading}
            className="text-xs px-3 py-1.5 bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
          >
            Start
          </button>
        )}
        {agent.status === 'running' && (
          <button
            onClick={onStop}
            disabled={loading}
            className="text-xs px-3 py-1.5 bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50"
          >
            Stop
          </button>
        )}
        <Link
          href={`/agents/${agent.id}`}
          className="text-xs px-3 py-1.5 border border-gray-300 text-gray-600 hover:border-primary hover:text-primary"
        >
          View
        </Link>
        <button
          onClick={onDelete}
          disabled={loading}
          className="text-xs px-3 py-1.5 border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 ml-auto"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchAgents = async () => {
    try {
      const { agents } = await api.listAgents();
      setAgents(agents);
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAgents();
    }
  }, [user]);

  const handleStart = async (id: string) => {
    setActionLoading(id);
    try {
      await api.startAgent(id);
      await fetchAgents();
    } catch (error) {
      console.error('Failed to start agent:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async (id: string) => {
    setActionLoading(id);
    try {
      await api.stopAgent(id);
      await fetchAgents();
    } catch (error) {
      console.error('Failed to stop agent:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agent? This will destroy all associated resources.')) {
      return;
    }

    setActionLoading(id);
    try {
      await api.deleteAgent(id);
      await fetchAgents();
    } catch (error) {
      console.error('Failed to delete agent:', error);
    } finally {
      setActionLoading(null);
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
          title="Agents"
          subtitle="Manage your deployed agents"
        />

        {loading ? (
          <div className="text-center py-16 text-gray-500">Loading agents...</div>
        ) : agents.length === 0 ? (
          <BracketCard>
            <EmptyState
              title="No agents yet"
              description="Create your first agent using the CLI: agentiom init my-agent"
            />
          </BracketCard>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onStart={() => handleStart(agent.id)}
                onStop={() => handleStop(agent.id)}
                onDelete={() => handleDelete(agent.id)}
                loading={actionLoading === agent.id}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
