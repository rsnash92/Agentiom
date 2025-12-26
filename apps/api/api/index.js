// Vercel Serverless Function handler
// Import the pre-built bundle from dist
import bundle from '../dist/index.js';

// The bundle exports { port, fetch } for Bun runtime
// Re-export the fetch handler for Vercel
export default bundle.fetch;
