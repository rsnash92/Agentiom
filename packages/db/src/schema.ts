/**
 * Database Schema - Phase 2
 * 
 * Includes sleep/wake and trigger fields for Phase 2 features.
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
// Agents - With Phase 2 Sleep/Wake Fields
// =============================================================================

export const agentStatus = [
  'pending',
  'deploying',
  'running',
  'sleeping',  // NEW: Agent is stopped but can be woken
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
    slug: text('slug').notNull().unique(),
    description: text('description'),

    // Status
    status: text('status', { enum: agentStatus }).notNull().default('pending'),

    // Infrastructure references
    machineId: text('machine_id'),
    volumeId: text('volume_id'),
    dnsRecordId: text('dns_record_id'),

    // Configuration (JSON)
    config: text('config', { mode: 'json' }),

    // Resource allocation
    region: text('region').notNull().default('iad'),
    cpuKind: text('cpu_kind').notNull().default('shared'),
    cpus: integer('cpus').notNull().default(1),
    memoryMb: integer('memory_mb').notNull().default(256),
    storageSizeGb: integer('storage_size_gb').notNull().default(1),

    // URLs
    url: text('url'),

    // =========================================================================
    // Phase 2: Sleep/Wake Fields
    // =========================================================================
    
    // Activity tracking for auto-sleep
    lastActivityAt: integer('last_activity_at', { mode: 'timestamp' }),
    
    // Auto-sleep configuration
    idleTimeoutMins: integer('idle_timeout_mins').notNull().default(5),
    autoSleep: integer('auto_sleep', { mode: 'boolean' }).notNull().default(true),
    
    // Wake tracking
    lastWakeAt: integer('last_wake_at', { mode: 'timestamp' }),
    lastSleepAt: integer('last_sleep_at', { mode: 'timestamp' }),
    wakeCount: integer('wake_count').notNull().default(0),
    
    // =========================================================================
    // Phase 2: Trigger Configuration
    // =========================================================================
    
    // Webhook trigger secret (for verifying incoming webhooks)
    webhookSecret: text('webhook_secret'),
    
    // Cron expression (if cron trigger enabled)
    cronExpression: text('cron_expression'),
    cronTimezone: text('cron_timezone').default('UTC'),
    
    // Email trigger (agent's email address)
    emailAddress: text('email_address'), // e.g., my-agent@agentiom.dev

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
    lastActivityIdx: index('agents_last_activity_idx').on(table.lastActivityAt),
    emailAddressIdx: index('agents_email_address_idx').on(table.emailAddress),
  })
);

export const agentsRelations = relations(agents, ({ one, many }) => ({
  user: one(users, {
    fields: [agents.userId],
    references: [users.id],
  }),
  deployments: many(deployments),
  triggers: many(triggers),
  wakeEvents: many(wakeEvents),
  integrations: many(integrations),
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
    imageTag: text('image_tag'),
    configSnapshot: text('config_snapshot', { mode: 'json' }),
    errorMessage: text('error_message'),
    errorStack: text('error_stack'),
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
// Phase 2: Triggers
// =============================================================================

export const triggerType = [
  'webhook',
  'cron',
  'email',
  'api',
] as const;

export type TriggerType = (typeof triggerType)[number];

export const triggers = sqliteTable(
  'triggers',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    
    type: text('type', { enum: triggerType }).notNull(),
    
    // Trigger-specific config (JSON)
    config: text('config', { mode: 'json' }),
    
    // For cron triggers
    cronExpression: text('cron_expression'),
    cronTimezone: text('cron_timezone').default('UTC'),
    nextRunAt: integer('next_run_at', { mode: 'timestamp' }),
    
    // For webhook triggers
    webhookPath: text('webhook_path'), // e.g., /api/events
    
    // Enabled/disabled
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
    
    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    lastTriggeredAt: integer('last_triggered_at', { mode: 'timestamp' }),
  },
  (table) => ({
    agentIdIdx: index('triggers_agent_id_idx').on(table.agentId),
    typeIdx: index('triggers_type_idx').on(table.type),
    nextRunIdx: index('triggers_next_run_idx').on(table.nextRunAt),
  })
);

export const triggersRelations = relations(triggers, ({ one }) => ({
  agent: one(agents, {
    fields: [triggers.agentId],
    references: [agents.id],
  }),
}));

// =============================================================================
// Phase 2: Wake Events (audit log)
// =============================================================================

export const wakeEvents = sqliteTable(
  'wake_events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    triggerId: text('trigger_id')
      .references(() => triggers.id, { onDelete: 'set null' }),
    
    // What caused the wake
    triggerType: text('trigger_type', { enum: triggerType }).notNull(),
    
    // Context about the trigger
    triggerContext: text('trigger_context', { mode: 'json' }),
    
    // How long did it take to wake (ms)?
    wakeLatencyMs: integer('wake_latency_ms'),
    
    // Success/failure
    success: integer('success', { mode: 'boolean' }).notNull().default(true),
    errorMessage: text('error_message'),
    
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    agentIdIdx: index('wake_events_agent_id_idx').on(table.agentId),
    triggerTypeIdx: index('wake_events_trigger_type_idx').on(table.triggerType),
    createdAtIdx: index('wake_events_created_at_idx').on(table.createdAt),
  })
);

export const wakeEventsRelations = relations(wakeEvents, ({ one }) => ({
  agent: one(agents, {
    fields: [wakeEvents.agentId],
    references: [agents.id],
  }),
  trigger: one(triggers, {
    fields: [wakeEvents.triggerId],
    references: [triggers.id],
  }),
}));

// =============================================================================
// Usage Records (for billing)
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
    type: text('type', {
      enum: ['compute', 'storage', 'email', 'browser'],
    }).notNull(),
    quantity: real('quantity').notNull(),
    unit: text('unit').notNull(),
    periodStart: integer('period_start', { mode: 'timestamp' }).notNull(),
    periodEnd: integer('period_end', { mode: 'timestamp' }).notNull(),
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

// =============================================================================
// Platform Integrations (Slack, Discord, Telegram, etc.)
// =============================================================================

export const integrationPlatform = [
  'slack',
  'discord',
  'telegram',
  'custom_websocket',
] as const;

export type IntegrationPlatform = (typeof integrationPlatform)[number];

export const integrationStatus = [
  'pending',      // Created but not connected
  'connecting',   // Attempting to establish connection
  'connected',    // Socket active and listening
  'disconnected', // Connection dropped, will retry
  'error',        // Failed, needs user intervention
  'disabled',     // Manually disabled
] as const;

export type IntegrationStatus = (typeof integrationStatus)[number];

export const integrations = sqliteTable(
  'integrations',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),

    // Platform type
    platform: text('platform', { enum: integrationPlatform }).notNull(),

    // Human-readable name (e.g., "Production Slack Workspace")
    name: text('name').notNull(),

    // Connection status
    status: text('status', { enum: integrationStatus }).notNull().default('pending'),
    statusMessage: text('status_message'), // Error details, etc.

    // ==========================================================================
    // Platform-specific credentials (encrypted in production)
    // ==========================================================================

    // Slack
    slackAppToken: text('slack_app_token'),       // xapp-... (Socket Mode)
    slackBotToken: text('slack_bot_token'),       // xoxb-... (API calls)
    slackTeamId: text('slack_team_id'),           // Workspace ID
    slackTeamName: text('slack_team_name'),       // Workspace name

    // Discord
    discordBotToken: text('discord_bot_token'),   // Bot token
    discordGuildId: text('discord_guild_id'),     // Server ID (optional, for single-server bots)
    discordApplicationId: text('discord_application_id'),

    // Telegram
    telegramBotToken: text('telegram_bot_token'), // Bot token from @BotFather
    telegramWebhookSecret: text('telegram_webhook_secret'), // For webhook verification

    // Custom WebSocket
    customWsUrl: text('custom_ws_url'),           // wss://...
    customWsHeaders: text('custom_ws_headers', { mode: 'json' }), // Auth headers

    // ==========================================================================
    // Event routing configuration
    // ==========================================================================

    // Which endpoint to hit when events arrive
    webhookPath: text('webhook_path').default('/webhook'),

    // Event filtering (JSON array of event types to forward)
    // e.g., ["message", "app_mention"] for Slack
    eventFilter: text('event_filter', { mode: 'json' }),

    // ==========================================================================
    // Connection tracking
    // ==========================================================================

    lastConnectedAt: integer('last_connected_at', { mode: 'timestamp' }),
    lastDisconnectedAt: integer('last_disconnected_at', { mode: 'timestamp' }),
    lastEventAt: integer('last_event_at', { mode: 'timestamp' }),

    // Stats
    eventsReceived: integer('events_received').notNull().default(0),
    eventsDelivered: integer('events_delivered').notNull().default(0),
    eventsFailed: integer('events_failed').notNull().default(0),

    // Retry tracking
    retryCount: integer('retry_count').notNull().default(0),
    nextRetryAt: integer('next_retry_at', { mode: 'timestamp' }),

    // Timestamps
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    agentIdIdx: index('integrations_agent_id_idx').on(table.agentId),
    platformIdx: index('integrations_platform_idx').on(table.platform),
    statusIdx: index('integrations_status_idx').on(table.status),
  })
);

export const integrationsRelations = relations(integrations, ({ one }) => ({
  agent: one(agents, {
    fields: [integrations.agentId],
    references: [agents.id],
  }),
}));

// =============================================================================
// Integration Events (Audit Log)
// =============================================================================

export const integrationEvents = sqliteTable(
  'integration_events',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    integrationId: text('integration_id')
      .notNull()
      .references(() => integrations.id, { onDelete: 'cascade' }),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),

    // Event type from the platform
    eventType: text('event_type').notNull(), // e.g., "message", "app_mention"

    // Raw event payload (for debugging)
    payload: text('payload', { mode: 'json' }),

    // Delivery status
    delivered: integer('delivered', { mode: 'boolean' }).notNull().default(false),
    deliveredAt: integer('delivered_at', { mode: 'timestamp' }),

    // If we had to wake the agent
    agentWasAsleep: integer('agent_was_asleep', { mode: 'boolean' }).notNull().default(false),
    wakeLatencyMs: integer('wake_latency_ms'),

    // Response from agent (if any)
    responsePayload: text('response_payload', { mode: 'json' }),
    responseSentAt: integer('response_sent_at', { mode: 'timestamp' }),

    // Error tracking
    errorMessage: text('error_message'),
    retryCount: integer('retry_count').notNull().default(0),

    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    integrationIdIdx: index('integration_events_integration_id_idx').on(table.integrationId),
    agentIdIdx: index('integration_events_agent_id_idx').on(table.agentId),
    eventTypeIdx: index('integration_events_event_type_idx').on(table.eventType),
    createdAtIdx: index('integration_events_created_at_idx').on(table.createdAt),
  })
);

export const integrationEventsRelations = relations(integrationEvents, ({ one }) => ({
  integration: one(integrations, {
    fields: [integrationEvents.integrationId],
    references: [integrations.id],
  }),
  agent: one(agents, {
    fields: [integrationEvents.agentId],
    references: [agents.id],
  }),
}));

// =============================================================================
// Activity Logs (Unified event log for agent activity)
// =============================================================================

export const activityType = [
  'wake',
  'sleep',
  'request',
  'response',
  'state_save',
  'error',
] as const;

export type ActivityType = (typeof activityType)[number];

export const activityLogs = sqliteTable(
  'activity_logs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => createId()),
    agentId: text('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),

    // Event type
    type: text('type', { enum: activityType }).notNull(),

    // Human-readable message
    message: text('message').notNull(),

    // Additional context (JSON)
    metadata: text('metadata', { mode: 'json' }),

    // Timestamp
    createdAt: text('created_at')
      .notNull()
      .$defaultFn(() => new Date().toISOString()),
  },
  (table) => ({
    agentIdIdx: index('activity_logs_agent_id_idx').on(table.agentId),
    typeIdx: index('activity_logs_type_idx').on(table.type),
    createdAtIdx: index('activity_logs_created_at_idx').on(table.createdAt),
  })
);

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  agent: one(agents, {
    fields: [activityLogs.agentId],
    references: [agents.id],
  }),
}));
