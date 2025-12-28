'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, Activity } from '@/lib/api';

const icons: Record<string, string> = {
  wake: '⚡',
  sleep: '😴',
  request: '📥',
  response: '📤',
  state_save: '💾',
  error: '❌',
};

const colors: Record<string, string> = {
  wake: 'text-yellow-500',
  sleep: 'text-blue-400',
  request: 'text-green-500',
  response: 'text-emerald-400',
  state_save: 'text-purple-400',
  error: 'text-red-500',
};

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);

  if (diffSecs < 60) return `${diffSecs}s ago`;
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

interface ActivityFeedProps {
  agentId: string;
}

export function ActivityFeed({ agentId }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      const { activities } = await api.getAgentActivity(agentId, 20);
      setActivities(activities);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch activities:', err);
      setError('Failed to load activity');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchActivities]);

  if (loading) {
    return (
      <div className="text-sm text-gray-500 animate-pulse">
        Loading activity...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500">
        {error}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        No activity yet. Activity will appear here when the agent is used.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start gap-3 text-sm">
          <span className={`${colors[activity.type]} flex-shrink-0`}>
            {icons[activity.type]}
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-gray-700">{activity.message}</span>
            {activity.metadata?.latencyMs && (
              <span className="text-gray-400 ml-1">
                ({activity.metadata.latencyMs}ms)
              </span>
            )}
          </div>
          <span className="text-gray-400 text-xs flex-shrink-0">
            {formatTimeAgo(activity.createdAt)}
          </span>
        </div>
      ))}
    </div>
  );
}
