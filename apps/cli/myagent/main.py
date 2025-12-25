"""
Agentiom Agent: myagent

This agent runs as a persistent container with storage at /home/agent/
"""

import os
import logging
from http.server import HTTPServer, BaseHTTPRequestHandler
import json

logging.basicConfig(
    level=os.getenv('LOG_LEVEL', 'INFO'),
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger(__name__)

AGENT_NAME = os.getenv('AGENT_NAME', 'myagent')
PORT = int(os.getenv('PORT', '8080'))


class AgentHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_json({'status': 'healthy', 'agent': AGENT_NAME})
        else:
            self.send_json({'message': f'Hello from {AGENT_NAME}!'})

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        data = json.loads(body) if body else {}
        logger.info(f"Received: {data}")
        self.send_json({'success': True, 'received': data})

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode())

    def log_message(self, format, *args):
        logger.info(f"{self.address_string()} - {format % args}")


if __name__ == '__main__':
    logger.info(f"Starting {AGENT_NAME} on port {PORT}")
    HTTPServer(('0.0.0.0', PORT), AgentHandler).serve_forever()
