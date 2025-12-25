/**
 * @agentiom/db
 *
 * Database package using Drizzle ORM with Turso (LibSQL/SQLite).
 *
 * @example
 * ```typescript
 * import { createDatabase, schema } from '@agentiom/db';
 *
 * const db = createDatabase(process.env.DATABASE_URL!, process.env.DATABASE_AUTH_TOKEN);
 *
 * // Query users
 * const users = await db.select().from(schema.users);
 *
 * // Insert agent
 * const [agent] = await db.insert(schema.agents).values({
 *   userId: 'user_123',
 *   name: 'my-agent',
 *   slug: 'my-agent',
 * }).returning();
 * ```
 */

export { createDatabase, schema } from './client';
export type { DatabaseClient } from './client';

// Re-export schema types
export type {
  AgentStatus,
  DeploymentStatus,
} from './schema';

// Re-export table types
export {
  users,
  apiTokens,
  agents,
  deployments,
  usageRecords,
} from './schema';
