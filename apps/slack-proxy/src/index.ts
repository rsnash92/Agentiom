import { App, LogLevel } from '@slack/bolt';
import Anthropic from '@anthropic-ai/sdk';
import { config } from 'dotenv';

// Load environment variables from .env file
config();

const SLACK_APP_TOKEN = process.env.SLACK_APP_TOKEN;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AGENTIOM_API_URL = process.env.AGENTIOM_API_URL || 'http://localhost:3000';
const AGENTIOM_API_TOKEN = process.env.AGENTIOM_API_TOKEN;
const DEFAULT_AGENT_SLUG = process.env.DEFAULT_AGENT_SLUG; // If set, routes messages through an Agentiom agent

if (!SLACK_APP_TOKEN || !SLACK_BOT_TOKEN) {
  console.error('Missing required environment variables: SLACK_APP_TOKEN, SLACK_BOT_TOKEN');
  process.exit(1);
}

if (!ANTHROPIC_API_KEY) {
  console.warn('⚠️ ANTHROPIC_API_KEY not set - AI responses will be disabled');
}

if (!AGENTIOM_API_TOKEN) {
  console.warn('⚠️ AGENTIOM_API_TOKEN not set - agent wake functionality disabled');
}

// Initialize Anthropic client
const anthropic = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY }) : null;

// Agentiom API helpers
interface AgentInfo {
  id: string;
  name: string;
  status: string;
}

async function wakeAgent(agentId: string): Promise<boolean> {
  if (!AGENTIOM_API_TOKEN) return false;

  try {
    console.log(`🔔 Waking agent ${agentId}...`);
    const response = await fetch(`${AGENTIOM_API_URL}/agents/${agentId}/wake`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AGENTIOM_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ triggerType: 'slack' }),
    });

    if (response.ok) {
      console.log(`✅ Agent ${agentId} woken successfully`);
      return true;
    } else {
      console.error(`❌ Failed to wake agent: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error('❌ Error waking agent:', error);
    return false;
  }
}

async function getAgentStatus(agentId: string): Promise<string | null> {
  if (!AGENTIOM_API_TOKEN) return null;

  try {
    const response = await fetch(`${AGENTIOM_API_URL}/agents/${agentId}/status`, {
      headers: {
        'Authorization': `Bearer ${AGENTIOM_API_TOKEN}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.status;
    }
    return null;
  } catch (error) {
    console.error('❌ Error getting agent status:', error);
    return null;
  }
}

async function listAgents(): Promise<AgentInfo[]> {
  if (!AGENTIOM_API_TOKEN) return [];

  try {
    const response = await fetch(`${AGENTIOM_API_URL}/agents`, {
      headers: {
        'Authorization': `Bearer ${AGENTIOM_API_TOKEN}`,
      },
    });

    if (response.ok) {
      return await response.json();
    }
    return [];
  } catch (error) {
    console.error('❌ Error listing agents:', error);
    return [];
  }
}

/**
 * Forward a message to an Agentiom agent via the proxy endpoint.
 * The proxy will wake the agent if sleeping, then forward the request.
 */
async function forwardToAgent(
  agentSlug: string,
  message: string,
  userId: string,
  channelId: string
): Promise<string> {
  if (!AGENTIOM_API_TOKEN) {
    return 'Agent routing not configured. Set AGENTIOM_API_TOKEN.';
  }

  try {
    console.log(`🚀 Forwarding to agent ${agentSlug}:`, message.substring(0, 50) + '...');

    // Use verbose mode and disable automatic decompression to work around Bun's Zstd issues
    const response = await fetch(`${AGENTIOM_API_URL}/agents/${agentSlug}/proxy/slack`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AGENTIOM_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept-Encoding': 'identity', // Request no compression
      },
      body: JSON.stringify({
        message,
        userId,
        channelId,
      }),
      // @ts-ignore - Bun-specific option
      decompress: false,
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Agent proxy error (${response.status}):`, error);

      if (response.status === 503) {
        return `Agent is waking up, please try again in a moment...`;
      }
      return `Sorry, I couldn't reach the agent. (Error ${response.status})`;
    }

    // Read as text first to avoid decompression issues, then parse
    const responseText = await response.text();
    console.log(`📥 Raw response:`, responseText.substring(0, 200));

    const data = JSON.parse(responseText);
    console.log(`✅ Agent response from ${agentSlug}:`, data.text?.substring(0, 100) + '...');

    return data.text || 'No response from agent';
  } catch (error) {
    console.error('❌ Error forwarding to agent:', error);
    return 'Sorry, I encountered an error connecting to the agent.';
  }
}

// Initialize Slack app with Socket Mode
const app = new App({
  token: SLACK_BOT_TOKEN,
  appToken: SLACK_APP_TOKEN,
  socketMode: true,
  logLevel: LogLevel.INFO,
});

// System prompt for the agent
const SYSTEM_PROMPT = `You are a helpful AI assistant integrated into Slack. You are part of Agentiom, a platform for deploying AI agents with persistent memory.

Key traits:
- Be concise and helpful
- Use Slack-friendly formatting (bold with *text*, code with \`code\`, lists with •)
- Keep responses under 2000 characters when possible
- Be friendly but professional

You can help with general questions, coding, brainstorming, and more.`;

// Handle special commands
async function handleCommand(command: string, args: string): Promise<string | null> {
  const cmd = command.toLowerCase();

  switch (cmd) {
    case 'agents':
    case 'list': {
      const agents = await listAgents();
      if (agents.length === 0) {
        return AGENTIOM_API_TOKEN
          ? '📋 No agents found.'
          : '⚠️ Agentiom API not configured. Set `AGENTIOM_API_TOKEN` to enable agent management.';
      }
      const agentList = agents.map(a => {
        const statusEmoji = a.status === 'running' ? '🟢' : a.status === 'stopped' ? '🔴' : '🟡';
        return `• ${statusEmoji} *${a.name}* (\`${a.id}\`) - ${a.status}`;
      }).join('\n');
      return `📋 *Available Agents:*\n${agentList}`;
    }

    case 'wake': {
      if (!args) {
        return '⚠️ Usage: `!wake <agent-id>`';
      }
      const success = await wakeAgent(args.trim());
      return success
        ? `✅ Agent \`${args.trim()}\` is waking up...`
        : `❌ Failed to wake agent \`${args.trim()}\``;
    }

    case 'status': {
      if (!args) {
        return '⚠️ Usage: `!status <agent-id>`';
      }
      const status = await getAgentStatus(args.trim());
      if (status) {
        const statusEmoji = status === 'running' ? '🟢' : status === 'stopped' ? '🔴' : '🟡';
        return `${statusEmoji} Agent \`${args.trim()}\` is *${status}*`;
      }
      return `❌ Could not get status for agent \`${args.trim()}\``;
    }

    case 'help': {
      return `🤖 *Agentiom Slack Bot Commands:*
• \`!agents\` - List all available agents
• \`!wake <id>\` - Wake a sleeping agent
• \`!status <id>\` - Check agent status
• \`!help\` - Show this help message

Or just talk to me directly and I'll respond using AI!`;
    }

    default:
      return null; // Not a command
  }
}

// Function to get AI response - routes to agent if configured, otherwise direct to Claude
async function getAIResponse(message: string, userId: string, channelId: string = ''): Promise<string> {
  // If an agent is configured, route through it for persistent memory
  if (DEFAULT_AGENT_SLUG && AGENTIOM_API_TOKEN) {
    return forwardToAgent(DEFAULT_AGENT_SLUG, message, userId, channelId);
  }

  // Fallback: direct Claude API call (no persistence)
  if (!anthropic) {
    return `🤖 AI is not configured. Please set ANTHROPIC_API_KEY or DEFAULT_AGENT_SLUG.\n\nYour message: "${message}"`;
  }

  try {
    console.log('🧠 Sending to Claude (direct, no persistence):', message);

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: message }
      ],
    });

    const textContent = response.content.find(block => block.type === 'text');
    const reply = textContent?.type === 'text' ? textContent.text : 'No response generated';

    console.log('✅ Claude response:', reply.substring(0, 100) + '...');
    return reply;
  } catch (error) {
    console.error('❌ Claude error:', error);
    return `Sorry, I encountered an error processing your request. Please try again.`;
  }
}

// Handle @mentions
app.event('app_mention', async ({ event, say, client }) => {
  console.log('📨 Received mention:', {
    user: event.user,
    channel: event.channel,
    text: event.text,
    ts: event.ts,
  });

  // Extract the message text (remove the bot mention)
  const botUserId = (await client.auth.test()).user_id;
  const messageText = event.text.replace(`<@${botUserId}>`, '').trim();

  console.log('💬 Message text:', messageText);

  // Check for commands (starts with !)
  let response: string;
  if (messageText.startsWith('!')) {
    const parts = messageText.slice(1).split(' ');
    const command = parts[0];
    const args = parts.slice(1).join(' ');
    const commandResponse = await handleCommand(command, args);
    if (commandResponse) {
      response = commandResponse;
    } else {
      response = await getAIResponse(messageText, event.user, event.channel);
    }
  } else {
    // Show typing indicator by reacting
    try {
      await client.reactions.add({
        channel: event.channel,
        timestamp: event.ts,
        name: 'hourglass_flowing_sand',
      });
    } catch (e) {
      // Ignore reaction errors
    }

    // Get AI response
    response = await getAIResponse(messageText, event.user, event.channel);

    // Remove typing indicator
    try {
      await client.reactions.remove({
        channel: event.channel,
        timestamp: event.ts,
        name: 'hourglass_flowing_sand',
      });
    } catch (e) {
      // Ignore reaction errors
    }
  }

  // Reply in thread
  try {
    await say({
      text: response,
      thread_ts: event.ts,
    });
  } catch (error) {
    console.error('Error responding:', error);
  }
});

// Handle direct messages
app.event('message', async ({ event, say, client }) => {
  // Only handle DMs (channel type 'im')
  // Skip bot messages and message_changed events
  if (
    event.channel_type !== 'im' ||
    'bot_id' in event ||
    event.subtype === 'message_changed'
  ) {
    return;
  }

  console.log('📨 Received DM:', {
    user: event.user,
    channel: event.channel,
    text: 'text' in event ? event.text : '(no text)',
    ts: event.ts,
  });

  const messageText = 'text' in event ? event.text || '' : '';

  // Check for commands (starts with !)
  let response: string;
  if (messageText.startsWith('!')) {
    const parts = messageText.slice(1).split(' ');
    const command = parts[0];
    const args = parts.slice(1).join(' ');
    const commandResponse = await handleCommand(command, args);
    response = commandResponse || await getAIResponse(messageText, event.user || 'unknown', event.channel);
  } else {
    response = await getAIResponse(messageText, event.user || 'unknown', event.channel);
  }

  try {
    await say({
      text: response,
    });
  } catch (error) {
    console.error('Error responding to DM:', error);
  }
});

// Start the app
(async () => {
  await app.start();
  console.log('⚡️ Slack Socket Proxy is running!');

  // Show routing mode
  if (DEFAULT_AGENT_SLUG && AGENTIOM_API_TOKEN) {
    console.log(`🤖 Mode: Agent routing → ${DEFAULT_AGENT_SLUG} (persistent memory)`);
    console.log(`🔗 Agentiom API: ${AGENTIOM_API_URL}`);
  } else if (anthropic) {
    console.log(`🧠 Mode: Direct Claude API (no persistence)`);
  } else {
    console.log(`⚠️ No AI configured! Set ANTHROPIC_API_KEY or DEFAULT_AGENT_SLUG`);
  }

  // List available agents on startup if connected
  if (AGENTIOM_API_TOKEN) {
    const agents = await listAgents();
    if (agents.length > 0) {
      console.log(`📋 Available agents: ${agents.map(a => `${a.name} (${a.status})`).join(', ')}`);
    }
  }
})();
