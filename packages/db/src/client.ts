/**
 * Database Client
 *
 * Creates and exports the Drizzle database client for Turso (LibSQL).
 */

import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

export type DatabaseClient = ReturnType<typeof createDatabase>;

/**
 * Create a database client
 *
 * @param url - Database URL (Turso URL or local file)
 * @param authToken - Auth token for Turso (optional for local)
 */
export function createDatabase(url: string, authToken?: string) {
  const client = createClient({
    url,
    authToken,
  });

  return drizzle(client, { schema });
}

// Export schema for use in queries
export { schema };
