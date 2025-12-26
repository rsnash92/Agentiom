'use client';

import { useEffect, useState } from 'react';

interface Activity {
  id: string;
  type: string;
  data: Record<string, any>;
  timestamp: string;
}

interface DemoStatus {
  agentStatus: 'sleeping' | 'waking' | 'running' | 'stopping';
  lastWake?: string;
  totalWakes: number;
  totalStars: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function LiveDemoFeed() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [activityRes, statusRes] = await Promise.all([
          fetch(`${API_URL}/demo/activity?limit=10`),
          fetch(`${API_URL}/demo/status`),
        ]);

        if (activityRes.ok) {
          const data = await activityRes.json();
          setActivities(data.activities || []);
        }

        if (statusRes.ok) {
          const data = await statusRes.json();
          setStatus(data);
        }
      } catch (e) {
        console.error('Failed to fetch demo data:', e);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <div className="animate-pulse bg-zinc-900 rounded-lg p-6">
        <div className="h-4 bg-zinc-800 rounded w-1/3 mb-4"></div>
        <div className="space-y-2">
          <div className="h-3 bg-zinc-800 rounded"></div>
          <div className="h-3 bg-zinc-800 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
      {/* Status Header */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              status?.agentStatus === 'running'
                ? 'bg-green-500 animate-pulse'
                : status?.agentStatus === 'waking'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-zinc-600'
            }`}
          />
          <span className="text-sm text-zinc-400">
            Demo Agent:{' '}
            <span className="text-zinc-200 capitalize">
              {status?.agentStatus || 'unknown'}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs text-zinc-500">
          <span>⭐ {status?.totalStars || 0} stars</span>
          <span>🔄 {status?.totalWakes || 0} wakes</span>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="divide-y divide-zinc-800/50 max-h-64 overflow-y-auto">
        {activities.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-500 text-sm">
            No activity yet. Star the repo to trigger the agent!
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="px-4 py-3 hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {activity.type === 'github_star' ? (
                    <span className="text-yellow-400">⭐</span>
                  ) : activity.type === 'wake' ? (
                    <span className="text-green-400">🌅</span>
                  ) : activity.type === 'sleep' ? (
                    <span className="text-blue-400">😴</span>
                  ) : (
                    <span className="text-zinc-500">📌</span>
                  )}
                  <span className="text-sm text-zinc-300">
                    {activity.type === 'github_star' ? (
                      <>
                        <span className="text-zinc-100">
                          {activity.data.stargazer}
                        </span>{' '}
                        starred the repo
                      </>
                    ) : activity.type === 'wake' ? (
                      'Agent woke up'
                    ) : activity.type === 'sleep' ? (
                      'Agent went to sleep'
                    ) : (
                      activity.type
                    )}
                  </span>
                </div>
                <span className="text-xs text-zinc-600 whitespace-nowrap">
                  {formatRelativeTime(activity.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return then.toLocaleDateString();
}
