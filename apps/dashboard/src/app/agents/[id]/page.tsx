'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Sidebar, Header, BracketCard, StatCard } from '@/components';
import { useAuth } from '@/lib/auth-context';
import { api, Agent, LogEntry } from '@/lib/api';

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

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour12: false });
}

export default function AgentDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<Agent | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchAgent = async () => {
    try {
      const { agent } = await api.getAgent(agentId);
      setAgent(agent);

      // Fetch logs if running
      if (agent.status === 'running') {
        const { logs } = await api.getAgentLogs(agentId);
        setLogs(logs);
      }
    } catch (error) {
      console.error('Failed to fetch agent:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && agentId) {
      fetchAgent();
    }
  }, [user, agentId]);

  const handleStart = async () => {
    if (!agent) return;
    setActionLoading(true);
    try {
      await api.startAgent(agent.id);
      await fetchAgent();
    } catch (error) {
      console.error('Failed to start agent:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    if (!agent) return;
    setActionLoading(true);
    try {
      await api.stopAgent(agent.id);
      await fetchAgent();
    } catch (error) {
      console.error('Failed to stop agent:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeploy = async () => {
    if (!agent) return;
    setActionLoading(true);
    try {
      await api.deployAgent(agent.id);
      await fetchAgent();
    } catch (error) {
      console.error('Failed to deploy agent:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!agent) return;
    if (!confirm('Are you sure you want to delete this agent? This will destroy all associated resources.')) {
      return;
    }

    setActionLoading(true);
    try {
      await api.deleteAgent(agent.id);
      router.push('/agents');
    } catch (error) {
      console.error('Failed to delete agent:', error);
      setActionLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!user || !agent) {
    return null;
  }

  const statusColors = {
    running: 'bg-emerald-100 text-emerald-700',
    stopped: 'bg-gray-100 text-gray-600',
    pending: 'bg-yellow-100 text-yellow-700',
    deploying: 'bg-blue-100 text-blue-700',
    failed: 'bg-red-100 text-red-700',
    destroyed: 'bg-gray-100 text-gray-500',
  };

  const levelColors: Record<string, string> = {
    INFO: 'text-emerald-400',
    DEBUG: 'text-cyan-400',
    WARN: 'text-yellow-400',
    ERROR: 'text-red-400',
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-56 p-8">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link href="/agents" className="hover:text-primary">Agents</Link>
          <span>/</span>
          <span className="text-gray-900">{agent.name}</span>
        </div>

        <Header
          title={agent.name}
          subtitle={agent.description || `Agent running in ${agent.region}`}
          action={
            <div className="flex items-center gap-2">
              {agent.status === 'pending' && (
                <button
                  onClick={handleDeploy}
                  disabled={actionLoading}
                  className="text-sm px-4 py-2 bg-primary text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Deploy
                </button>
              )}
              {agent.status === 'stopped' && (
                <button
                  onClick={handleStart}
                  disabled={actionLoading}
                  className="text-sm px-4 py-2 bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50"
                >
                  Start
                </button>
              )}
              {agent.status === 'running' && (
                <button
                  onClick={handleStop}
                  disabled={actionLoading}
                  className="text-sm px-4 py-2 bg-gray-500 text-white hover:bg-gray-600 disabled:opacity-50"
                >
                  Stop
                </button>
              )}
              <button
                onClick={handleDelete}
                disabled={actionLoading}
                className="text-sm px-4 py-2 border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          }
        />

        {/* Status */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="bg-white border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</p>
            <span className={`text-sm px-2 py-0.5 rounded ${statusColors[agent.status]}`}>
              {agent.status}
            </span>
          </div>
          <StatCard label="Region" value={agent.region.toUpperCase()} />
          <StatCard label="Created" value={formatTimeAgo(agent.createdAt)} />
          <StatCard label="Updated" value={formatTimeAgo(agent.updatedAt)} />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Details */}
          <BracketCard>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">ID</span>
                <code className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded">{agent.id}</code>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Slug</span>
                <span className="text-gray-900">{agent.slug}</span>
              </div>
              {agent.machineId && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Machine ID</span>
                  <code className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">{agent.machineId}</code>
                </div>
              )}
              {agent.volumeId && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Volume ID</span>
                  <code className="text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs">{agent.volumeId}</code>
                </div>
              )}
              {agent.endpoint && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Endpoint</span>
                  <a
                    href={agent.endpoint}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-xs"
                  >
                    {agent.endpoint}
                  </a>
                </div>
              )}
            </div>
          </BracketCard>

          {/* Logs */}
          <BracketCard>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Recent Logs</h2>
              <button
                onClick={fetchAgent}
                className="text-xs text-primary hover:underline"
              >
                Refresh
              </button>
            </div>
            <div className="font-mono text-xs bg-gray-900 text-gray-300 p-4 rounded max-h-64 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-gray-500">
                  {agent.status === 'running'
                    ? 'No logs available yet.'
                    : 'Start the agent to see logs.'}
                </p>
              ) : (
                <div className="space-y-1">
                  {logs.slice(-20).map((log, i) => (
                    <p key={i}>
                      <span className="text-gray-500">[{formatTimestamp(log.timestamp)}]</span>{' '}
                      <span className={levelColors[log.level] || 'text-gray-300'}>{log.level}</span>{' '}
                      {log.message}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </BracketCard>
        </div>
      </main>
    </div>
  );
}
