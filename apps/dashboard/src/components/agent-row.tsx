'use client';

import Link from 'next/link';

interface AgentRowProps {
  name: string;
  status: 'running' | 'stopped' | 'error';
  region: string;
  lastActive: string;
}

export function AgentRow({ name, status, region, lastActive }: AgentRowProps) {
  const statusColors = {
    running: 'running',
    stopped: 'stopped',
    error: 'error',
  };

  const statusLabels = {
    running: 'Running',
    stopped: 'Stopped',
    error: 'Error',
  };

  return (
    <div className="flex items-center justify-between py-3 px-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
      <div className="flex items-center gap-3">
        <div className={`status-dot ${statusColors[status]}`} />
        <div>
          <Link href={`/agents/${name}`} className="text-sm font-medium text-gray-900 hover:text-primary">
            {name}
          </Link>
          <p className="text-xs text-gray-500">{region}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-gray-400">{lastActive}</span>
        <span className={`text-xs px-2 py-0.5 rounded ${
          status === 'running' ? 'bg-emerald-100 text-emerald-700' :
          status === 'error' ? 'bg-red-100 text-red-700' :
          'bg-gray-100 text-gray-600'
        }`}>
          {statusLabels[status]}
        </span>
      </div>
    </div>
  );
}
