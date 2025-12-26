# Agentiom Socket Proxy

A lightweight always-on service that maintains persistent connections to messaging platforms (Slack, Discord, Telegram) and forwards events to sleeping agents.

## The Problem

Many chat-based agents need to respond to messages from Slack, Discord, or Telegram. These platforms require persistent socket connections to receive events in real-time. But if your agent "sleeps" to save costs (like on Fly.io or Cloudflare), the socket connection dies.

**The Socket Proxy solves this:**

```
┌─────────────────────────────────────────────────────────┐
│  Socket Proxy (always-on, tiny footprint)               │
│                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                   │
│  │ Slack   │ │ Discord │ │Telegram │                   │
│  │ Socket  │ │ Gateway │ │ Polling │                   │
│  └────┬────┘ └────┬────┘ └────┬────┘                   │
│       └───────────┼───────────┘                         │
│                   │                                     │
│                   ▼                                     │
│         ┌─────────────────────────┐                    │
│         │  Event Router           │                    │
│         │  1. Wake agent          │                    │
│         │  2. Deliver event       │                    │
│         │  3. Send response back  │                    │
│         └─────────────────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

## Features

- **Slack Socket Mode** - No public endpoint required
- **Discord Gateway** - Full Discord.js integration
- **Telegram** - Both polling and webhook support
- **Auto-reconnect** - Exponential backoff with jitter
- **Event filtering** - Only forward events you care about
- **Response routing** - Agent responses go back to the right channel

## Quick Start

### 1. Install

```bash
cd apps/socket-proxy
bun install
```

### 2. Configure Environment

```bash
# .env
PORT=3002
AGENTIOM_API_URL=http://localhost:3001
AGENTIOM_INTERNAL_TOKEN=your-internal-token
DATABASE_URL=your-database-url
```

### 3. Run

```bash
bun run dev
```

## API

### Health Check

```bash
GET /health

{
  "status": "ok",
  "uptime": 3600,
  "connections": {
    "total": 5,
    "connected": 4,
    "disconnected": 1,
    "error": 0,
    "byPlatform": {
      "slack": 3,
      "discord": 2
    }
  }
}
```

### Connect Integration

```bash
POST /connections
Content-Type: application/json

{
  "integrationId": "clx123...",
  "config": {
    "id": "clx123...",
    "agentId": "agent_456",
    "platform": "slack",
    "name": "My Slack Workspace",
    "slackAppToken": "xapp-...",
    "slackBotToken": "xoxb-..."
  }
}
```

### Disconnect

```bash
DELETE /connections/:integrationId
```

### Reconnect

```bash
POST /connections/:integrationId/reconnect
```

## Platform Setup

### Slack

1. Create a Slack App at https://api.slack.com/apps
2. Enable **Socket Mode** under Settings
3. Generate an **App-Level Token** with `connections:write` scope
4. Add a **Bot User** and install to workspace
5. Subscribe to events (e.g., `message.channels`, `app_mention`)

```json
{
  "platform": "slack",
  "slackAppToken": "xapp-1-xxx",
  "slackBotToken": "xoxb-xxx"
}
```

### Discord

1. Create a Discord Application at https://discord.com/developers
2. Add a **Bot** and copy the token
3. Enable required **Privileged Intents** (Message Content, etc.)
4. Generate an OAuth2 URL and invite to your server

```json
{
  "platform": "discord",
  "discordBotToken": "xxx",
  "discordGuildId": "optional-server-id"
}
```

### Telegram

1. Create a bot via @BotFather
2. Copy the bot token

```json
{
  "platform": "telegram",
  "telegramBotToken": "123456:ABC-xxx"
}
```

## Agent Integration

When the socket proxy receives an event, it:

1. Calls `POST /internal/trigger/:agentId` to wake the agent
2. Forwards the event to `POST {agent_url}/webhook`
3. If the agent returns a response, sends it back to the platform

### Event Payload

```json
{
  "type": "message",
  "platform": "slack",
  "timestamp": "2025-01-15T10:30:00Z",
  "payload": {
    // Platform-specific event data
  },
  "respondTo": "C123ABC",
  "replyToken": "1234567890.123456"
}
```

### Response Format

To reply, return JSON from your webhook:

```json
// Slack
{ "text": "Hello from the agent!" }

// Discord
{ "content": "Hello from the agent!" }

// Telegram
{ "text": "Hello from the agent!" }
```

## Event Filtering

Only receive events you care about:

```json
{
  "eventFilter": ["message", "app_mention"]
}
```

### Slack Events
- `message` - All messages
- `app_mention` - @mentions
- `app_home_opened` - Home tab opened
- `reaction_added` / `reaction_removed`
- `slash_command`
- `interactive` - Buttons, modals

### Discord Events
- `messageCreate` - New messages
- `interactionCreate` - Slash commands, buttons
- `guildMemberAdd` / `guildMemberRemove`
- `messageReactionAdd`

### Telegram Events
- `message` - All messages
- `callback_query` - Inline buttons
- `inline_query` - Inline mode
- `edited_message`
- `channel_post`

## Deployment

### Fly.io

The socket proxy should run as an always-on service (not scale-to-zero):

```toml
# fly.toml
app = "agentiom-socket-proxy"

[build]
  dockerfile = "Dockerfile"

[http_service]
  internal_port = 3002
  force_https = true
  auto_stop_machines = false  # Always on!
  auto_start_machines = true
  min_machines_running = 1

[[vm]]
  memory = "256mb"
  cpu_kind = "shared"
  cpus = 1
```

```bash
fly deploy
fly secrets set AGENTIOM_API_URL=https://api.agentiom.dev
fly secrets set AGENTIOM_INTERNAL_TOKEN=xxx
```

### Docker

```bash
docker build -t agentiom-socket-proxy .
docker run -p 3002:3002 \
  -e AGENTIOM_API_URL=http://api:3001 \
  -e AGENTIOM_INTERNAL_TOKEN=xxx \
  agentiom-socket-proxy
```

## Cost Considerations

The socket proxy is designed to be extremely lightweight:

- **Memory**: ~50-100MB base, +~5MB per active connection
- **CPU**: Minimal (just forwarding messages)
- **Network**: Depends on message volume

On Fly.io, a single shared-cpu-1x 256MB machine (~$2/month) can handle hundreds of integrations.

## Troubleshooting

### Connection keeps dropping

Check your token permissions. Slack Socket Mode needs `connections:write` scope on the app token.

### Events not arriving

1. Verify event subscriptions in platform settings
2. Check event filter configuration
3. Look at socket proxy logs

### Agent not waking

1. Verify `AGENTIOM_API_URL` is correct
2. Check agent status in dashboard
3. Look for errors in `/internal/trigger` calls

## Architecture Notes

### Why a Separate Service?

We could have each agent maintain its own socket connections, but:

1. **Cost**: Sleeping agents can't hold sockets. Keeping agents always-on is expensive.
2. **Complexity**: Each agent would need reconnection logic, health checks, etc.
3. **Efficiency**: One proxy can manage thousands of connections efficiently.

### Multi-Region

For global presence, deploy socket proxies in multiple regions. Each maintains connections for agents in its region.

### High Availability

Run 2+ replicas behind a load balancer. Each connection only lives on one instance, but the fleet provides redundancy.
