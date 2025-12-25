'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar, Header, BracketCard, EmptyState } from '@/components';
import { useAuth } from '@/lib/auth-context';
import { api, Agent, LogEntry } from '@/lib/api';

function formatTimestamp(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour12: false });
}

interface AgentLogs {
  agent: Agent;
  logs: LogEntry[];
}

export default function LogsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [agentLogs, setAgentLogs] = useState<AgentLogs[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>('all');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchLogs = async () => {
    try {
      const { agents } = await api.listAgents();
      const runningAgents = agents.filter(a => a.status === 'running');

      const logsPromises = runningAgents.map(async (agent) => {
        try {
          const { logs } = await api.getAgentLogs(agent.id);
          return { agent, logs };
        } catch {
          return { agent, logs: [] };
        }
      });

      const results = await Promise.all(logsPromises);
      setAgentLogs(results);
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchLogs();
      // Refresh logs every 10 seconds
      const interval = setInterval(fetchLogs, 10000);
      return () => clearInterval(interval);
    }
  }, [user]);

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

  const levelColors: Record<string, string> = {
    INFO: 'text-emerald-400',
    DEBUG: 'text-cyan-400',
    WARN: 'text-yellow-400',
    ERROR: 'text-red-400',
  };

  // Combine and sort all logs
  const allLogs = agentLogs
    .flatMap(({ agent, logs }) =>
      logs.map(log => ({ ...log, agentName: agent.name }))
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const filteredLogs = selectedAgent === 'all'
    ? allLogs
    : allLogs.filter(log => log.agentName === selectedAgent);

  const agents = agentLogs.map(al => al.agent);

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-56 p-8">
        <Header
          title="Logs"
          subtitle="View logs from all running agents"
          action={
            <button
              onClick={fetchLogs}
              className="text-sm px-4 py-2 border border-gray-300 hover:border-primary text-gray-600 hover:text-primary"
            >
              Refresh
            </button>
          }
        />

        {loading ? (
          <div className="text-center py-16 text-gray-500">Loading logs...</div>
        ) : agents.length === 0 ? (
          <BracketCard>
            <EmptyState
              title="No running agents"
              description="Start an agent to see its logs here"
              actionLabel="View Agents"
              actionHref="/agents"
            />
          </BracketCard>
        ) : (
          <>
            {/* Agent filter */}
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm text-gray-500">Filter:</span>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="text-sm border border-gray-300 px-3 py-1.5 focus:outline-none focus:border-primary"
              >
                <option value="all">All agents</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.name}>{agent.name}</option>
                ))}
              </select>
            </div>

            <BracketCard>
              <div className="font-mono text-xs bg-gray-900 text-gray-300 p-4 rounded min-h-[400px] max-h-[600px] overflow-y-auto">
                {filteredLogs.length === 0 ? (
                  <p className="text-gray-500">No logs available yet.</p>
                ) : (
                  <div className="space-y-1">
                    {filteredLogs.slice(0, 100).map((log, i) => (
                      <p key={i}>
                        <span className="text-gray-500">[{formatTimestamp(log.timestamp)}]</span>{' '}
                        <span className="text-purple-400">{log.agentName}</span>{' '}
                        <span className={levelColors[log.level] || 'text-gray-300'}>{log.level}</span>{' '}
                        {log.message}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </BracketCard>
          </>
        )}
      </main>
    </div>
  );
}
