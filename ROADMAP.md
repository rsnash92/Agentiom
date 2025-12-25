# Agentiom Roadmap

This is our public roadmap. We're building in public — follow along and join the journey!

## Vision

Build the complete platform for stateful AI agents. Let developers deploy agents that remember, wake on triggers, and act autonomously.

---

## Phase 1: Foundation (Weeks 1-6) 🚧 In Progress

**Goal:** CLI deploys persistent containers with storage

### Week 1-2: Core Infrastructure
- [x] Project structure (Turborepo monorepo)
- [x] Provider abstraction layer (Fly.io)
- [x] Database schema (Drizzle + Turso)
- [ ] API server setup (Hono)
- [ ] Authentication (JWT + API tokens)

### Week 3-4: CLI & Deploy
- [ ] CLI scaffolding (Commander.js)
- [ ] `agentiom login` command
- [ ] `agentiom init` command
- [ ] `agentiom deploy` command
- [ ] Container builds and registry push

### Week 5-6: Agent Lifecycle
- [ ] `agentiom status` command
- [ ] `agentiom logs` command
- [ ] `agentiom start/stop` commands
- [ ] `agentiom destroy` command
- [ ] DNS setup (Cloudflare)

### Phase 1 Deliverable
```bash
agentiom init my-agent
cd my-agent
agentiom deploy
# → https://my-agent.agentiom.dev running
```

---

## Phase 2: Sleep/Wake & Email (Weeks 7-10)

**Goal:** Agents sleep when idle, wake on triggers

### Features
- [ ] Sleep/wake orchestration
- [ ] Email interface (`agent@agentiom.dev` → agent wakes)
- [ ] Webhook triggers (HTTP → agent wakes)
- [ ] Always-on heartbeat (optional)
- [ ] Cost tracking per agent

### Phase 2 Deliverable
```yaml
# agent.yaml
triggers:
  email: true          # agent@agentiom.dev
  webhook: /incoming   # POST → wake agent
```

---

## Phase 3: Cron, Browser, Memory (Weeks 11-16)

**Goal:** Full trigger suite + agent capabilities

### Features
- [ ] Cron scheduling (`0 9 * * *` → agent wakes at 9am)
- [ ] Browser automation (Browserbase integration)
- [ ] Simple memory (SQLite + vector embeddings)
- [ ] File uploads to agent storage
- [ ] Agent environment secrets

### Phase 3 Deliverable
```yaml
triggers:
  cron: "0 9 * * *"
  
tools:
  - browser
  
memory:
  type: simple
```

---

## Phase 4: Dashboard & Billing (Weeks 17-22)

**Goal:** Web UI for managing agents + paid plans

### Features
- [ ] Web dashboard (Next.js)
- [ ] Agent management UI
- [ ] Log viewer
- [ ] Usage analytics
- [ ] Stripe billing integration
- [ ] Free tier limits
- [ ] Team/organization support

### Phase 4 Deliverable
- `app.agentiom.dev` — Full dashboard
- Billing: Free → Pro ($29/mo) → Team ($99/mo)

---

## Phase 5: Community & Templates (Weeks 23+)

**Goal:** Ecosystem and marketplace

### Features
- [ ] Agent templates gallery
- [ ] One-click deploy templates
- [ ] Community contributions
- [ ] Agent sharing (public agents)
- [ ] Custom domains
- [ ] Advanced memory (Letta integration)
- [ ] MCP server support

---

## Future Considerations

### Multi-Provider Support
- AWS ECS/Fargate
- GCP Cloud Run
- Own infrastructure (bare metal)

### Enterprise Features
- SSO/SAML
- Audit logs
- VPC peering
- SLA guarantees

### Advanced Capabilities
- Agent-to-agent communication
- Swarm orchestration
- GPU support
- Long-running workflows

---

## How to Follow Along

- **GitHub**: Star and watch for updates
- **Twitter/X**: [@agentiom](https://twitter.com/agentiom) — Daily updates
- **Discord**: [discord.gg/agentiom](https://discord.gg/agentiom) — Community chat
- **Blog**: [agentiom.dev/blog](https://agentiom.dev/blog) — Deep dives

## Want to Contribute?

See [CONTRIBUTING.md](CONTRIBUTING.md) for how to get involved!

---

*Last updated: December 2024*
