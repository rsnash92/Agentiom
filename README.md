# Agentiom

[![Build in Public](https://img.shields.io/badge/Build%20in%20Public-Yes-brightgreen)](https://github.com/agentiom/agentiom)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE.md)

An open-source platform for deploying stateful AI agents. Built in public.

**[Website](https://agentiom.dev)** · **[Documentation](https://docs.agentiom.dev)** · **[Discord](https://discord.gg/agentiom)** · **[Twitter](https://twitter.com/agentiom)**

---

## What is Agentiom?

Agentiom is the complete platform for stateful AI agents. Deploy agents that:

- **Remember** — Persistent storage that survives restarts
- **Wake** — Sleep when idle, wake on triggers (email, cron, webhooks)
- **Act** — Browser automation, email, and API access built-in
- **Scale** — From hobby projects to production workloads

```bash
# Deploy an agent in 3 commands
npx agentiom init my-agent
cd my-agent
npx agentiom deploy
```

---

## What's Included

| Technology | Purpose |
|------------|---------|
| [Hono](https://hono.dev/) | API Framework |
| [Turborepo](https://turbo.build) | Build System |
| [Bun](https://bun.sh) | Runtime & Package Manager |
| [Biome](https://biomejs.dev) | Linter & Formatter |
| [TailwindCSS](https://tailwindcss.com/) | Styling |
| [Shadcn](https://ui.shadcn.com/) | UI Components |
| [TypeScript](https://www.typescriptlang.org/) | Type Safety |
| [Drizzle](https://orm.drizzle.team/) | ORM |
| [Turso](https://turso.tech/) | Database (SQLite) |
| [Fly.io](https://fly.io/) | Compute & Storage |
| [Cloudflare](https://cloudflare.com/) | DNS |
| [Resend](https://resend.com/) | Email Delivery |
| [Upstash](https://upstash.com/) | Rate Limiting & KV |
| [Trigger.dev](https://trigger.dev/) | Background Jobs |
| [Sentry](https://sentry.io/) | Error Monitoring |
| [OpenPanel](https://openpanel.dev/) | Analytics |
| [Stripe](https://stripe.com/) | Billing |

---

## Directory Structure

```
agentiom/
├── apps/                           # Applications
│   ├── api/                        # Control Plane API (Hono)
│   ├── app/                        # Dashboard (Next.js)
│   ├── web/                        # Marketing Site (Next.js)
│   ├── cli/                        # CLI Tool
│   └── docs/                       # Documentation (Mintlify)
│
├── packages/                       # Shared Packages
│   ├── providers/                  # Infrastructure Abstraction Layer
│   │   ├── src/
│   │   │   ├── interfaces/         # Provider interfaces
│   │   │   │   ├── compute.ts      # IComputeProvider
│   │   │   │   ├── storage.ts      # IStorageProvider
│   │   │   │   └── dns.ts          # IDNSProvider
│   │   │   ├── fly/                # Fly.io implementation
│   │   │   └── cloudflare/         # Cloudflare implementation
│   │   └── package.json
│   │
│   ├── db/                         # Database (Drizzle + Turso)
│   │   ├── src/
│   │   │   ├── schema.ts           # Database schema
│   │   │   ├── client.ts           # DB client
│   │   │   └── migrations/         # SQL migrations
│   │   └── package.json
│   │
│   ├── shared/                     # Shared Types & Utilities
│   │   ├── src/
│   │   │   ├── types/              # TypeScript types
│   │   │   ├── schemas/            # Zod validation schemas
│   │   │   └── utils/              # Helper functions
│   │   └── package.json
│   │
│   ├── ui/                         # UI Components (Shadcn)
│   │   ├── src/components/
│   │   └── package.json
│   │
│   ├── email/                      # Email Templates (React Email)
│   │   ├── src/templates/
│   │   └── package.json
│   │
│   ├── jobs/                       # Background Jobs (Trigger.dev)
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── kv/                         # KV & Rate Limiting (Upstash)
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── analytics/                  # Analytics (OpenPanel)
│   │   ├── src/
│   │   └── package.json
│   │
│   └── logger/                     # Logging (Pino)
│       ├── src/
│       └── package.json
│
├── tooling/                        # Shared Configuration
│   └── typescript/                 # TypeScript configs
│       ├── base.json
│       ├── nextjs.json
│       └── library.json
│
├── docker/                         # Docker Images
│   └── agent-base/                 # Base image for agents
│       ├── Dockerfile
│       └── entrypoint.sh
│
├── .cursor/                        # Cursor AI Rules
│   └── rules/
│       ├── general.mdc
│       ├── api.mdc
│       └── react.mdc
│
├── .cursorrules                    # Legacy Cursor rules (backup)
├── .github/                        # GitHub Actions
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
│
├── biome.json                      # Biome configuration
├── turbo.json                      # Turborepo configuration
├── package.json                    # Root package.json
├── tsconfig.json                   # Root TypeScript config
├── LICENSE.md                      # MIT License
└── README.md                       # This file
```

---

## Prerequisites

- [Bun](https://bun.sh) (v1.1+)
- [Docker](https://docker.com) (for local Supabase)
- [Fly.io Account](https://fly.io)
- [Turso Account](https://turso.tech)
- [Cloudflare Account](https://cloudflare.com)
- [Resend Account](https://resend.com)
- [Stripe Account](https://stripe.com)

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/agentiom/agentiom.git
cd agentiom
```

### 2. Install dependencies

```bash
bun install
```

### 3. Set up environment variables

```bash
# Copy example env files
cp apps/api/.env.example apps/api/.env
cp apps/app/.env.example apps/app/.env
cp apps/web/.env.example apps/web/.env
```

Edit each `.env` file with your credentials.

### 4. Set up the database

```bash
# Run migrations
bun db:migrate

# Seed initial data (optional)
bun db:seed
```

### 5. Start development

```bash
# Start all apps
bun dev

# Or start individually
bun dev:api     # Control plane API
bun dev:app     # Dashboard
bun dev:web     # Marketing site
bun dev:docs    # Documentation
```

---

## Scripts

| Command | Description |
|---------|-------------|
| `bun dev` | Start all apps in development mode |
| `bun dev:api` | Start the API server |
| `bun dev:app` | Start the dashboard |
| `bun dev:web` | Start the marketing site |
| `bun build` | Build all apps |
| `bun test` | Run all tests |
| `bun lint` | Lint all code |
| `bun format` | Format all code |
| `bun typecheck` | Type-check all code |
| `bun db:migrate` | Run database migrations |
| `bun db:seed` | Seed the database |
| `bun db:studio` | Open Drizzle Studio |

---

## Architecture

### Provider Abstraction

Agentiom uses a provider abstraction layer that allows swapping infrastructure:

```typescript
// packages/providers/src/interfaces/compute.ts
interface IComputeProvider {
  createMachine(config: MachineConfig): Promise<Machine>;
  startMachine(id: string): Promise<Machine>;
  stopMachine(id: string): Promise<Machine>;
  destroyMachine(id: string): Promise<void>;
  // ...
}

// Current implementation: Fly.io
// Future: Own infrastructure, AWS, GCP, etc.
```

This means you can:
- Start with Fly.io (recommended)
- Migrate to your own infrastructure later
- Support multiple providers simultaneously

### Sleep/Wake Architecture

Agents sleep when idle to minimize costs:

```
Trigger (email/webhook/cron)
        │
        ▼
┌─────────────────┐
│   Orchestrator  │  ← Always running, lightweight
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Wake Agent     │  ← ~300ms cold start
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Process Request │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Sleep (idle)   │  ← After configurable timeout
└─────────────────┘
```

---

## Deployment

### Deploy to Fly.io

The API and dashboard can be deployed to Fly.io:

```bash
# Deploy API
cd apps/api
fly deploy

# Deploy Dashboard
cd apps/app
fly deploy
```

### Deploy Marketing Site to Vercel

```bash
cd apps/web
vercel
```

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make your changes
4. Run tests: `bun test`
5. Run linting: `bun lint`
6. Commit with conventional commits: `git commit -m "feat: add new feature"`
7. Push and create a PR

---

## Build in Public

We're building Agentiom in public! Follow along:

- **GitHub**: All code is open source
- **Twitter/X**: [@agentiom](https://twitter.com/agentiom) — Daily updates
- **Discord**: [discord.gg/agentiom](https://discord.gg/agentiom) — Community chat
- **Blog**: [agentiom.dev/blog](https://agentiom.dev/blog) — Technical deep dives
- **YouTube**: Technical walkthroughs and demos

### Roadmap

- [x] Phase 1: Foundation (CLI, API, Deploy) — *In Progress*
- [ ] Phase 2: Sleep/Wake & Email Interface
- [ ] Phase 3: Browser, Cron, Memory
- [ ] Phase 4: Dashboard & Billing
- [ ] Phase 5: Templates & Community

See [ROADMAP.md](ROADMAP.md) for detailed milestones.

---

## License

MIT License — see [LICENSE.md](LICENSE.md)

---

## Acknowledgments

- [Midday](https://midday.ai) — Inspiration for the monorepo structure
- [Letta](https://letta.ai) — Inspiration for agent memory architecture
- [TinyFat](https://tinyfat.com) — Validation of the stateful agent pain points
- [Fly.io](https://fly.io) — Amazing infrastructure for persistent containers

---

<p align="center">
  <strong>Built with ❤️ for the agent economy</strong>
</p>
