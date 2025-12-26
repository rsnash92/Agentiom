# GitHub Integration Specification

How Agentiom's GitHub integration will work - modeled after Vercel's excellent DX.

## User Flow

### 1. Connect GitHub

```
┌─────────────────────────────────────────────────────────┐
│  agentiom.dev/new                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Import Git Repository                                  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Connect GitHub Account                          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Or use CLI: npx agentiom deploy                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 2. Select Repository

```
┌─────────────────────────────────────────────────────────┐
│  Import Repository                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Search repositories...                                 │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ rob/trading-bot                                 │   │
│  │    Updated 2 hours ago                          │   │
│  │                                     [Import]    │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ rob/slack-assistant                             │   │
│  │    Updated yesterday                            │   │
│  │                                     [Import]    │   │
│  ├─────────────────────────────────────────────────┤   │
│  │ rob/research-agent                              │   │
│  │    Updated 3 days ago                           │   │
│  │                                     [Import]    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Don't see your repo?                                   │
│  [Adjust GitHub App Permissions]                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3. Configure Agent

```
┌─────────────────────────────────────────────────────────┐
│  Configure trading-bot                                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Agent Name                                             │
│  ┌─────────────────────────────────────────────────┐   │
│  │ trading-bot                                     │   │
│  └─────────────────────────────────────────────────┘   │
│  https://trading-bot.agentiom.dev                       │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Detected: Node.js agent (package.json found)           │
│                                                         │
│  Build Command (auto-detected)                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ bun install                                     │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Start Command (auto-detected)                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ bun run src/index.ts                            │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  Triggers                                               │
│  [x] Webhook  [ ] Cron  [ ] Slack  [ ] Discord          │
│                                                         │
│  Environment Variables                                  │
│  ┌─────────────────────────────────────────────────┐   │
│  │ OPENAI_API_KEY = ••••••••••••••••               │   │
│  │ [+ Add Variable]                                │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│                                         [Deploy]        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4. Deployment

```
┌─────────────────────────────────────────────────────────┐
│  Deploying trading-bot...                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [===============               ] 50%                   │
│                                                         │
│  [done] Cloning repository                              │
│  [done] Installing dependencies                         │
│  [....] Building container...                           │
│  [    ] Deploying to Fly.io                             │
│  [    ] Configuring DNS                                 │
│  [    ] Setting up triggers                             │
│                                                         │
└─────────────────────────────────────────────────────────┘

        (30 seconds later)

┌─────────────────────────────────────────────────────────┐
│  Deployed!                                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Your agent is live at:                                 │
│  https://trading-bot.agentiom.dev                       │
│                                                         │
│  Webhook URL:                                           │
│  https://trading-bot.agentiom.dev/webhook               │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│                                                         │
│  What's next?                                           │
│                                                         │
│  - Push to main branch -> auto-deploys                  │
│  - Open PR -> preview agent deployed                    │
│  - Add integrations (Slack, Discord)                    │
│                                                         │
│  [View Dashboard]  [View Logs]                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

## Auto-Deploy on Push

Once connected, every push to `main` triggers a deployment:

```
┌──────────────────────────────────────────────────────────┐
│  GitHub                          Agentiom                │
│                                                          │
│  git push origin main                                    │
│         │                                                │
│         v                                                │
│  ┌──────────────┐    webhook    ┌───────────────────┐   │
│  │ rob/trading- │ ───────────── │ Build Service     │   │
│  │     bot      │               │                   │   │
│  └──────────────┘               │  - Clone repo     │   │
│                                 │  - Build          │   │
│                                 │  - Deploy         │   │
│                                 └───────────────────┘   │
│                                          │              │
│                                          v              │
│                                 ┌───────────────────┐   │
│                                 │ trading-bot       │   │
│                                 │ Status: Running   │   │
│                                 │ Version: abc123   │   │
│                                 └───────────────────┘   │
│                                          │              │
│         <────────────────────────────────┘              │
│  Commit status: Deployed                                │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Preview Deployments (PRs)

When a PR is opened, a preview agent is deployed:

```
┌──────────────────────────────────────────────────────────┐
│  Pull Request #42: Add new trading strategy              │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Agentiom Bot                                       │ │
│  │                                                    │ │
│  │ Preview agent deployed!                            │ │
│  │                                                    │ │
│  │ https://trading-bot-pr-42.agentiom.dev            │ │
│  │                                                    │ │
│  │ This preview will be deleted when PR is closed.   │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Checks                                                  │
│  [done] Agentiom Preview - Deployed                      │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## Implementation Details

### GitHub App Configuration

```yaml
# GitHub App Settings
name: Agentiom
url: https://agentiom.dev
webhook_url: https://api.agentiom.dev/github/webhook
webhook_secret: ${GITHUB_WEBHOOK_SECRET}

permissions:
  contents: read        # Clone repositories
  pull_requests: write  # Comment on PRs
  statuses: write       # Update commit status

events:
  - push               # Trigger deployments
  - pull_request       # Preview deployments
  - installation       # App installed/uninstalled
```

### Webhook Handler

```typescript
// apps/api/src/routes/github.routes.ts

app.post('/github/webhook', async (c) => {
  const event = c.req.header('X-GitHub-Event');
  const payload = await c.req.json();

  switch (event) {
    case 'push':
      // Main branch push -> deploy
      if (payload.ref === 'refs/heads/main') {
        await triggerDeploy({
          repoId: payload.repository.id,
          commit: payload.after,
          branch: 'main',
        });
      }
      break;

    case 'pull_request':
      // PR opened/updated -> preview deploy
      if (['opened', 'synchronize'].includes(payload.action)) {
        await triggerPreviewDeploy({
          repoId: payload.repository.id,
          prNumber: payload.number,
          commit: payload.pull_request.head.sha,
        });
      }
      // PR closed -> delete preview
      if (payload.action === 'closed') {
        await deletePreviewDeploy({
          repoId: payload.repository.id,
          prNumber: payload.number,
        });
      }
      break;

    case 'installation':
      // App installed -> sync repos
      await syncRepositories(payload.installation.id);
      break;
  }
});
```

### Build Service

```typescript
// apps/api/src/services/build.service.ts

export async function buildAndDeploy(config: BuildConfig) {
  const { repoUrl, commit, agentId, env } = config;

  // 1. Clone repository
  await exec(`git clone ${repoUrl} /tmp/build-${commit}`);
  await exec(`git checkout ${commit}`);

  // 2. Detect runtime & build
  const runtime = await detectRuntime('/tmp/build-${commit}');
  // Returns: 'nodejs' | 'python' | 'docker'

  // 3. Build container image
  const dockerfile = generateDockerfile(runtime);
  await buildImage(dockerfile, agentId, commit);

  // 4. Push to registry
  await pushImage(agentId, commit);

  // 5. Deploy to Fly.io
  await deployToFly(agentId, commit, env);

  // 6. Update DNS
  await updateDns(agentId);

  // 7. Report status back to GitHub
  await reportDeployStatus(config, 'success');
}
```

### Database Schema

```typescript
// packages/db/src/schema.ts

export const githubConnections = sqliteTable('github_connections', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id),
  installationId: integer('installation_id').notNull(),
  accessToken: text('access_token'), // Encrypted
  refreshToken: text('refresh_token'), // Encrypted
  createdAt: integer('created_at', { mode: 'timestamp' }),
});

export const githubRepos = sqliteTable('github_repos', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id').references(() => githubConnections.id),
  agentId: text('agent_id').references(() => agents.id),
  repoId: integer('repo_id').notNull(), // GitHub repo ID
  repoFullName: text('repo_full_name').notNull(), // owner/repo
  branch: text('branch').default('main'),
  autoDeploy: integer('auto_deploy', { mode: 'boolean' }).default(true),
  lastDeployedCommit: text('last_deployed_commit'),
  lastDeployedAt: integer('last_deployed_at', { mode: 'timestamp' }),
});

export const deployments = sqliteTable('deployments', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').references(() => agents.id),
  repoId: text('repo_id').references(() => githubRepos.id),
  commit: text('commit').notNull(),
  branch: text('branch'),
  prNumber: integer('pr_number'), // If preview deployment
  status: text('status', {
    enum: ['pending', 'building', 'deploying', 'success', 'failed']
  }),
  url: text('url'),
  logs: text('logs'),
  startedAt: integer('started_at', { mode: 'timestamp' }),
  completedAt: integer('completed_at', { mode: 'timestamp' }),
});
```

## Priority

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| GitHub OAuth flow | 1 day | High | P0 |
| Repo listing & selection | 1 day | High | P0 |
| Push -> deploy | 2 days | High | P0 |
| Commit status updates | 0.5 day | Medium | P1 |
| PR preview deployments | 2 days | Medium | P1 |
| PR comments | 0.5 day | Low | P2 |
| Branch selection | 0.5 day | Low | P2 |

## Implementation Order

1. **Phase 1: Basic Connect & Deploy**
   - GitHub OAuth
   - List repositories
   - Manual import -> deploy

2. **Phase 2: Auto Deploy**
   - Webhook receiver
   - Push -> deploy pipeline
   - Commit status updates

3. **Phase 3: Preview Deploys**
   - PR webhooks
   - Preview agent creation
   - PR comments
   - Cleanup on merge/close
