/**
 * Logger utility for Agentiom
 * 
 * Uses pino for structured JSON logging.
 * Falls back to console if pino not available.
 */

export interface Logger {
  debug(obj: object, msg?: string): void;
  info(obj: object, msg?: string): void;
  warn(obj: object, msg?: string): void;
  error(obj: object, msg?: string): void;
}

/**
 * Simple console-based logger implementation
 * For production, replace with pino
 */
class ConsoleLogger implements Logger {
  constructor(private name: string) {}

  private format(level: string, obj: object, msg?: string): string {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] ${level.toUpperCase()} [${this.name}]`;
    if (msg) {
      return `${prefix} ${msg} ${JSON.stringify(obj)}`;
    }
    return `${prefix} ${JSON.stringify(obj)}`;
  }

  debug(obj: object, msg?: string): void {
    if (process.env.LOG_LEVEL === 'debug') {
      console.debug(this.format('debug', obj, msg));
    }
  }

  info(obj: object, msg?: string): void {
    console.info(this.format('info', obj, msg));
  }

  warn(obj: object, msg?: string): void {
    console.warn(this.format('warn', obj, msg));
  }

  error(obj: object, msg?: string): void {
    console.error(this.format('error', obj, msg));
  }
}

/**
 * Create a logger instance for a component
 */
export function createLogger(name: string): Logger {
  return new ConsoleLogger(name);
}
