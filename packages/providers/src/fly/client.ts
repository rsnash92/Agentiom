/**
 * Fly.io API Client
 *
 * Low-level HTTP client for the Fly.io Machines API.
 * https://fly.io/docs/machines/api/
 */

export class FlyApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown
  ) {
    super(`Fly API Error (${status}): ${message}`);
    this.name = 'FlyApiError';
  }
}

export class FlyClient {
  private baseUrl = 'https://api.machines.dev/v1';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  async get<T = unknown>(path: string): Promise<T> {
    return this.request('GET', path);
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request('POST', path, body);
  }

  async put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request('PUT', path, body);
  }

  async delete<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request('DELETE', path, body);
  }

  async stream(path: string): Promise<AsyncIterable<string>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new FlyApiError(response.status, text);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    return this.readLines(response.body);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const text = await response.text();
      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(text);
      } catch {
        parsedBody = text;
      }
      throw new FlyApiError(response.status, text, parsedBody);
    }

    // Handle empty responses
    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  private async *readLines(
    stream: ReadableStream<Uint8Array>
  ): AsyncIterable<string> {
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim()) {
            yield line;
          }
        }
      }

      // Yield any remaining content
      if (buffer.trim()) {
        yield buffer;
      }
    } finally {
      reader.releaseLock();
    }
  }
}
