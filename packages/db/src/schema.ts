/**
 * Database Schema
 *
 * Defines all database tables using Drizzle ORM.
 * Uses SQLite (Turso) for simplicity and edge compatibility.
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

// =============================================================================
// Users
// =============================================================================

export const users = sqliteTable(
  'users',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    email: text('email').notNull().unique(),
    name: text('name'),
    passwordHash: text('password_hash').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    emailIdx: index('users_email_idx').on(table.email),
  })
);

export const usersRelations = relations(users, ({ many }) => ({
  apiTokens: many(apiTokens),
  agents: many(agents),
}));

// =============================================================================
// API Tokens
// =============================================================================

export const apiTokens = sqliteTable(
  'api_tokens',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('token_hash').notNull(),
    lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
    expiresAt: integer('expires_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('api_tokens_user_id_idx').on(table.userId),
    tokenHashIdx: index('api_tokens_token_hash_idx').on(table.tokenHash),
  })
);

export const apiTokensRelations = relations(apiTokens, ({ one }) => ({
  user: one(users, {
    fields: [apiTokens.userId],
    references: [users.id],
  }),
}));

// =============================================================================
// Agents
// =============================================================================

export const agentStatus = [
  'pending',
  'deploying',
  'running',
  'stopped',
  'error',
  'destroyed',
] as const;

export type AgentStatus = (typeof agentStatus)[number];

export const agents = sqliteTable(
  'agents',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(), // URL-safe name for subdomain
    description: text('description'),

    // Status
    status: text('status', { enum: agentStatus }).notNull().default('pending'),

    // Infrastructure references (provider-agnostic IDs)
    machineId: text('machine_id'),
    volumeId: text('volume_id'),
    dnsRecordId: text('dns_record_id'),

    // Configuration (stored as JSON)
    config: text('config', { mode: 'json' }),

    // Resource allocation
    region: text('region').notNull().default('iad'),
    cpuKind: text('cpu_kind').notNull().default('shared'),
    cpus: integer('cpus').notNull().default(1),
    memoryMb: integer('memory_mb').notNull().default(256),
    storageSizeGb: integer('storage_size_gb').notNull().default(1),

    // URLs
    url: text('url'), // https://my-agent.agentiom.dev

    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    lastDeployedAt: integer('last_deployed_at', { mode: 'timestamp' }),
  },
  (table) => ({
    userIdIdx: index('agents_user_id_idx').on(table.userId),
    slugIdx: index('agents_slug_idx').on(table.slug),
    statusIdx: index('agents_status_idx').on(table.status),
  })
);

export const agentsRelations = relations(agents, ({ one, many }) => ({
  user: one(users, {
    fields: [agents.userId],
    references: [users.id],
  }),
  deployments: many(deployments),
}));

// =============================================================================
// Deployments
// =============================================================================

export const deploymentStatus = [
  'pending',
  'building',
  'deploying',
  'success',
  'failed',
] as const;

export type DeploymentStatus = (typeof deploymentStatus)[number];

export const deployments = sqliteTable(
  'deployments',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id),

    status: text('status', { enum: deploymentStatus })
      .notNull()
      .default('pending'),

    // Deployment details
    imageTag: text('image_tag'),
    configSnapshot: text('config_snapshot', { mode: 'json' }),

    // Error tracking
    errorMessage: text('error_message'),
    errorStack: text('error_stack'),

    // Timestamps
    startedAt: integer('started_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    completedAt: integer('completed_at', { mode: 'timestamp' }),
  },
  (table) => ({
    agentIdIdx: index('deployments_agent_id_idx').on(table.agentId),
    userIdIdx: index('deployments_user_id_idx').on(table.userId),
    statusIdx: index('deployments_status_idx').on(table.status),
  })
);

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  agent: one(agents, {
    fields: [deployments.agentId],
    references: [agents.id],
  }),
  user: one(users, {
    fields: [deployments.userId],
    references: [users.id],
  }),
}));

// =============================================================================
// Usage (for billing)
// =============================================================================

export const usageRecords = sqliteTable(
  'usage_records',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: text('agent_id').references(() => agents.id, {
      onDelete: 'set null',
    }),

    // Usage type
    type: text('type', {
      enum: ['compute', 'storage', 'email', 'browser'],
    }).notNull(),

    // Usage amount
    quantity: real('quantity').notNull(),
    unit: text('unit').notNull(), // 'seconds', 'gb', 'requests'

    // Billing period
    periodStart: integer('period_start', { mode: 'timestamp' }).notNull(),
    periodEnd: integer('period_end', { mode: 'timestamp' }).notNull(),

    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('usage_records_user_id_idx').on(table.userId),
    agentIdIdx: index('usage_records_agent_id_idx').on(table.agentId),
    periodIdx: index('usage_records_period_idx').on(
      table.periodStart,
      table.periodEnd
    ),
  })
);

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  user: one(users, {
    fields: [usageRecords.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [usageRecords.agentId],
    references: [agents.id],
  }),
}));
