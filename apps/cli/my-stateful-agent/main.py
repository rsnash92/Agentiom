"""
Agentiom Agent: my-stateful-agent

A stateful agent that remembers data across sleep/wake cycles.
State is persisted to /data/state.json on the attached volume.
"""

import os
import json
import logging
import signal
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path

logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

AGENT_NAME = os.getenv('AGENTIOM_AGENT_NAME', os.getenv('AGENT_NAME', 'my-stateful-agent'))
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


# Global state manager
state = StateManager(STATE_PATH)


class AgentHandler(BaseHTTPRequestHandler):
    """HTTP handler for agent requests."""

    def do_GET(self):
        if self.path == '/health':
            self.send_json({
                'status': 'healthy',
                'agent': AGENT_NAME,
                'state_keys': len(state.data)
            })
        else:
            # Track visit count - this persists across sleep/wake!
            count = state.increment('visit_count')
            self.send_json({
                'message': f'Hello from {AGENT_NAME}!',
                'visit_count': count,
                'note': 'This count persists even when the agent sleeps!'
            })

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        data = json.loads(body) if body else {}

        # Example: Store messages in state
        messages = state.get('messages', [])
        if 'message' in data:
            messages.append({
                'text': data['message'],
                'count': state.increment('message_count')
            })
            state.set('messages', messages[-100:])  # Keep last 100

        logger.info(f"Received: {data}")

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

    try:
        HTTPServer(('0.0.0.0', PORT), AgentHandler).serve_forever()
    except KeyboardInterrupt:
        shutdown_handler(None, None)
