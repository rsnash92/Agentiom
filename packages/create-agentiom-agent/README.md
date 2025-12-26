# create-agentiom-agent

Scaffold a new Agentiom agent project from a template.

## Usage

```bash
# Interactive mode
npx create-agentiom-agent

# With project name
npx create-agentiom-agent my-agent

# With template
npx create-agentiom-agent my-agent --template=slack-bot
```

## Templates

| Template | Description |
|----------|-------------|
| `blank` | Start from scratch with a minimal agent |
| `webhook-handler` | Handle HTTP webhooks with persistent state |
| `slack-bot` | Respond to Slack messages with context memory |
| `discord-bot` | Full Discord integration with state |
| `cron-agent` | Run scheduled tasks daily or hourly |

## What's Created

```
my-agent/
├── src/
│   └── index.ts      # Your agent code
├── package.json
├── tsconfig.json
├── .gitignore
├── README.md
└── agentiom.json     # (for some templates)
```

## Next Steps

After creating your agent:

```bash
cd my-agent
bun install
bun run dev
```

Then deploy to Agentiom:

```bash
bun run deploy
```

## Learn More

- [Agentiom Documentation](https://docs.agentiom.dev)
- [SDK Reference](https://docs.agentiom.dev/sdk)
- [Examples](https://github.com/agentiom/examples)
