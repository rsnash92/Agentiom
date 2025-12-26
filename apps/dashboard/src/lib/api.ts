/**
 * API Client for Dashboard
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  private async fetch<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...options.headers as Record<string, string>,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });

    const data = await res.json();

    if (!res.ok) {
      const errorData = data as ApiError;
      throw new Error(errorData.error?.message || 'Request failed');
    }

    return data as T;
  }

  // Auth
  async register(email: string, password: string) {
    const data = await this.fetch<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.fetch<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.fetch<{ user: User }>('/auth/me');
  }

  logout() {
    this.setToken(null);
  }

  // Agents
  async listAgents() {
    return this.fetch<{ agents: Agent[] }>('/agents');
  }

  async getAgent(id: string) {
    return this.fetch<{ agent: Agent }>(`/agents/${id}`);
  }

  async createAgent(data: { name: string; description?: string; region?: string }) {
    return this.fetch<{ agent: Agent }>('/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAgent(id: string, data: Partial<Agent>) {
    return this.fetch<{ agent: Agent }>(`/agents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteAgent(id: string) {
    return this.fetch<{ success: boolean }>(`/agents/${id}`, {
      method: 'DELETE',
    });
  }

  async deployAgent(id: string) {
    return this.fetch<{ agent: Agent; deployment: Deployment }>(`/agents/${id}/deploy`, {
      method: 'POST',
    });
  }

  async startAgent(id: string) {
    return this.fetch<{ agent: Agent }>(`/agents/${id}/start`, {
      method: 'POST',
    });
  }

  async stopAgent(id: string) {
    return this.fetch<{ agent: Agent }>(`/agents/${id}/stop`, {
      method: 'POST',
    });
  }

  async wakeAgent(id: string) {
    return this.fetch<{ success: boolean; status: string; previousStatus: string; latencyMs: number }>(
      `/agents/${id}/wake`,
      {
        method: 'POST',
        body: JSON.stringify({ triggerType: 'api' }),
      }
    );
  }

  async sleepAgent(id: string) {
    return this.fetch<{ success: boolean; status: string; previousStatus: string }>(
      `/agents/${id}/sleep`,
      {
        method: 'POST',
      }
    );
  }

  async getAgentLogs(id: string) {
    return this.fetch<{ logs: LogEntry[] }>(`/agents/${id}/logs`);
  }

  // API Tokens
  async listTokens() {
    return this.fetch<{ tokens: ApiToken[] }>('/auth/tokens');
  }

  async createToken(name: string) {
    return this.fetch<{ token: ApiToken }>('/auth/tokens', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  async revokeToken(tokenId: string) {
    return this.fetch<{ success: boolean }>(`/auth/tokens/${tokenId}`, {
      method: 'DELETE',
    });
  }
}

// Types
export interface User {
  id: string;
  email: string;
  createdAt: string;
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  slug: string;
  description: string | null;
  status: 'pending' | 'deploying' | 'running' | 'sleeping' | 'stopped' | 'failed' | 'destroyed';
  region: string;
  machineId: string | null;
  volumeId: string | null;
  endpoint: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Deployment {
  id: string;
  agentId: string;
  status: string;
  createdAt: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

export interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export const api = new ApiClient();
