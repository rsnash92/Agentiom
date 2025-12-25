'use client';

import { CheckCircleIcon, ClockIcon } from './icons';

interface AgentCardProps {
  name: string;
  initial: string;
  description: string;
  status: 'running' | 'sleeping';
  url: string;
  color: 'blue' | 'orange' | 'green' | 'purple' | 'cyan' | 'pink';
}

export function AgentCard({ name, initial, description, status, url, color }: AgentCardProps) {
  const colorClasses = {
    blue: 'agent-avatar-blue',
    orange: 'agent-avatar-orange',
    green: 'agent-avatar-green',
    purple: 'agent-avatar-purple',
    cyan: 'agent-avatar-cyan',
    pink: 'agent-avatar-pink',
  };

  return (
    <div className="bg-white border border-gray-200 p-4 transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/10">
      <div className="flex items-center gap-3 mb-2">
        <div className={`agent-avatar ${colorClasses[color]}`}>{initial}</div>
        <span className="font-semibold text-[15px] text-gray-900">{name}</span>
      </div>
      <div className="text-[13px] text-gray-400 mb-2">{description}</div>
      <div
        className={`flex items-center gap-1.5 text-xs font-medium ${
          status === 'running' ? 'text-emerald-500' : 'text-amber-500'
        }`}
      >
        {status === 'running' ? (
          <CheckCircleIcon className="w-3.5 h-3.5" />
        ) : (
          <ClockIcon className="w-3.5 h-3.5" />
        )}
        {status === 'running' ? 'Running' : 'Sleeping'}
      </div>
      <div className="text-[11px] text-gray-400 font-mono mt-1">↗ {url}</div>
    </div>
  );
}
