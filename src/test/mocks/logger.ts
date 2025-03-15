/**
 * Mock loggers for testing
 */
import { Logger } from "../../utils/logger";

// Silent logger that does nothing - use this to silence logs during tests
export class SilentLogger implements Logger {
  debug(_message: string, ..._args: any[]): void {
    // Intentionally empty - silences debug logs
  }
  info(_message: string, ..._args: any[]): void {
    // Intentionally empty - silences info logs
  }
  warn(_message: string, ..._args: any[]): void {
    // Intentionally empty - silences warning logs
  }
  error(_message: string, ..._args: any[]): void {
    // Intentionally empty - silences error logs
  }
}

// Spy logger that captures logs for assertions
export class SpyLogger implements Logger {
  public logs: { level: string; message: string; args: any[] }[] = [];

  debug(message: string, ...args: any[]): void {
    this.logs.push({ level: "debug", message, args });
  }

  info(message: string, ...args: any[]): void {
    this.logs.push({ level: "info", message, args });
  }

  warn(message: string, ...args: any[]): void {
    this.logs.push({ level: "warn", message, args });
  }

  error(message: string, ...args: any[]): void {
    this.logs.push({ level: "error", message, args });
  }

  reset(): void {
    this.logs = [];
  }

  // Helper methods for assertions
  containsMessage(level: string, messageSubstring: string): boolean {
    return this.logs.some(
      (log) => log.level === level && log.message.includes(messageSubstring)
    );
  }
}
