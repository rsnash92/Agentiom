"""
Agentiom Agent: slack-assistant

A stateful agent that remembers data across sleep/wake cycles.
State is persisted to /data/state.json on the attached volume.

Supports:
- HTTP GET/POST for general requests
- POST /slack for Slack message handling with Claude AI
"""

import os
import json
import logging
import signal
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from datetime import datetime
from urllib.parse import urlparse

# Optional: Anthropic for AI responses
try:
    import anthropic
    CLAUDE_AVAILABLE = bool(os.getenv('ANTHROPIC_API_KEY'))
except ImportError:
    CLAUDE_AVAILABLE = False

logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

AGENT_NAME = os.getenv('AGENTIOM_AGENT_NAME', os.getenv('AGENT_NAME', 'slack-assistant'))
PORT = int(os.getenv('PORT', '8080'))
STATE_PATH = Path(os.getenv('AGENTIOM_STATE_PATH', '/data')) / 'state.json'


class StateManager:
    """Persistent state that survives sleep/wake cycles."""

    def __init__(self, path: Path):
        self.path = path
        self.data = {}
        self.load()

    def load(self):
        """Load state from disk."""
        try:
            if self.path.exists():
                with open(self.path) as f:
                    self.data = json.load(f)
                logger.info(f"Loaded state ({len(self.data)} keys)")
            else:
                logger.info("No existing state, starting fresh")
        except Exception as e:
            logger.error(f"Failed to load state: {e}")
            self.data = {}

    def save(self):
        """Save state to disk."""
        try:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.path, 'w') as f:
                json.dump(self.data, f, indent=2, default=str)
            logger.info("State saved")
        except Exception as e:
            logger.error(f"Failed to save state: {e}")

    def get(self, key, default=None):
        return self.data.get(key, default)

    def set(self, key, value):
        self.data[key] = value

    def increment(self, key, by=1):
        self.data[key] = self.get(key, 0) + by
        return self.data[key]

    def append_to_list(self, key, value, max_items=100):
        """Append to a list in state, keeping last N items."""
        items = self.get(key, [])
        items.append(value)
        self.set(key, items[-max_items:])
        return items


# Global state manager
state = StateManager(STATE_PATH)

# Claude client (if available)
claude = anthropic.Anthropic() if CLAUDE_AVAILABLE else None


def get_slack_response(message: str, user_id: str, channel_id: str) -> str:
    """Generate a response to a Slack message using Claude with persistent memory."""

    if not claude:
        return f"AI not configured. Your message: {message}"

    # Get conversation history for this user
    history_key = f"slack_history_{user_id}"
    conversation = state.get(history_key, [])

    # Get user info from state
    user_key = f"slack_user_{user_id}"
    user_info = state.get(user_key, {})

    # Build context from persistent state
    context_parts = []
    if user_info.get('name'):
        context_parts.append(f"User's name: {user_info['name']}")
    if user_info.get('preferences'):
        context_parts.append(f"User preferences: {user_info['preferences']}")
    if user_info.get('notes'):
        context_parts.append(f"Notes about user: {user_info['notes']}")

    # Build system prompt with persistent context
    system_prompt = f"""You are a helpful AI assistant with persistent memory. You are part of Agentiom, a platform for AI agents.

Your name is {AGENT_NAME}.

{chr(10).join(context_parts) if context_parts else "You don't have any saved information about this user yet."}

Key traits:
- Be concise and helpful
- Use Slack-friendly formatting (bold with *text*, code with `code`, lists with •)
- Keep responses under 2000 characters
- Remember information users tell you - it will be saved to your persistent state
- If a user tells you their name or preferences, acknowledge that you'll remember it

When a user shares personal information like their name, respond naturally and remember it for future conversations."""

    # Build messages from history
    messages = []
    for entry in conversation[-10:]:  # Last 10 exchanges
        messages.append({"role": "user", "content": entry["user"]})
        messages.append({"role": "assistant", "content": entry["assistant"]})

    # Add current message
    messages.append({"role": "user", "content": message})

    try:
        logger.info(f"Sending to Claude: {message[:100]}...")

        response = claude.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            system=system_prompt,
            messages=messages
        )

        reply = response.content[0].text
        logger.info(f"Claude response: {reply[:100]}...")

        # Save conversation to state
        conversation.append({
            "user": message,
            "assistant": reply,
            "timestamp": datetime.now().isoformat()
        })
        state.set(history_key, conversation[-50:])  # Keep last 50 exchanges

        # Extract and save user info if mentioned
        message_lower = message.lower()
        if "my name is" in message_lower or "i'm " in message_lower or "i am " in message_lower:
            # Simple name extraction
            import re
            patterns = [
                r"my name is ([A-Za-z]+)",
                r"i'm ([A-Za-z]+)",
                r"i am ([A-Za-z]+)",
                r"call me ([A-Za-z]+)"
            ]
            for pattern in patterns:
                match = re.search(pattern, message_lower)
                if match:
                    name = match.group(1).capitalize()
                    user_info['name'] = name
                    user_info['name_set_at'] = datetime.now().isoformat()
                    state.set(user_key, user_info)
                    logger.info(f"Saved user name: {name}")
                    break

        # Save state after each interaction
        state.save()

        return reply

    except Exception as e:
        logger.error(f"Claude error: {e}")
        return f"Sorry, I encountered an error. Please try again."


class AgentHandler(BaseHTTPRequestHandler):
    """HTTP handler for agent requests."""

    def do_GET(self):
        path = urlparse(self.path).path

        if path == '/health':
            self.send_json({
                'status': 'healthy',
                'agent': AGENT_NAME,
                'claude_enabled': CLAUDE_AVAILABLE,
                'state_keys': len(state.data)
            })
        else:
            # Track visit count - this persists across sleep/wake!
            count = state.increment('visit_count')
            self.send_json({
                'message': f'Hello from {AGENT_NAME}!',
                'visit_count': count,
                'claude_enabled': CLAUDE_AVAILABLE,
                'note': 'This count persists even when the agent sleeps!'
            })

    def do_POST(self):
        path = urlparse(self.path).path
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        data = json.loads(body) if body else {}

        logger.info(f"POST {path}: {json.dumps(data)[:200]}")

        # Handle Slack messages
        if path == '/slack':
            message = data.get('message', '')
            user_id = data.get('userId', 'unknown')
            channel_id = data.get('channelId', '')

            if not message:
                self.send_json({'error': 'No message provided'}, 400)
                return

            response_text = get_slack_response(message, user_id, channel_id)

            self.send_json({
                'text': response_text,
                'agent': AGENT_NAME
            })
            return

        # Default POST handler - store messages
        messages = state.get('messages', [])
        if 'message' in data:
            messages.append({
                'text': data['message'],
                'count': state.increment('message_count'),
                'timestamp': datetime.now().isoformat()
            })
            state.set('messages', messages[-100:])
            state.save()

        self.send_json({
            'success': True,
            'received': data,
            'total_messages': state.get('message_count', 0),
            'note': 'Messages are stored and persist across sleep/wake!'
        })

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        logger.info(f"{self.address_string()} - {format % args}")


def shutdown_handler(signum, frame):
    """Handle graceful shutdown - save state before sleeping."""
    logger.info("Shutdown signal received, saving state...")
    state.save()
    logger.info("Agent ready to sleep")
    sys.exit(0)


if __name__ == '__main__':
    # Register shutdown handlers
    signal.signal(signal.SIGTERM, shutdown_handler)
    signal.signal(signal.SIGINT, shutdown_handler)

    logger.info(f"Starting {AGENT_NAME} on port {PORT}")
    logger.info(f"State path: {STATE_PATH}")
    logger.info(f"Claude AI: {'Enabled' if CLAUDE_AVAILABLE else 'Disabled (no API key)'}")

    try:
        HTTPServer(('0.0.0.0', PORT), AgentHandler).serve_forever()
    except KeyboardInterrupt:
        shutdown_handler(None, None)
