/**
 * Logger interface and implementation
 * Used to centralize logging and make it easier to mock during tests
 */

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

// Default implementation that uses console
export class ConsoleLogger implements Logger {
  debug(message: string, ...args: any[]): void {
    console.log(`[DEBUG] ${message}`, ...args);
  }

  info(message: string, ...args: any[]): void {
    console.log(`[INFO] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  error(message: string, ...args: any[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

// Create a singleton instance
let instance: Logger = new ConsoleLogger();

// Allow replacing the logger
export function setLogger(logger: Logger): void {
  instance = logger;
}

// Get the current logger instance
export function getLogger(): Logger {
  return instance;
}
