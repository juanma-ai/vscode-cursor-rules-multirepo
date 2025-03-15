/**
 * This file is used to set up the test environment before running tests.
 * It's imported by the Mocha runner.
 */

// Set up module aliases for mocks
import Module = require("module");

// Store the original require
const originalRequire = Module.prototype.require;

// Define a type for the global mocks object
interface GlobalWithMocks extends NodeJS.Global {
  __mocks__?: Record<string, unknown>;
}

// Override the require function to return mocks for certain modules
Module.prototype.require = function (request: string) {
  if (request === "vscode") {
    return require("./mocks/vscode");
  }

  // Check if we have a mock for this module in the global __mocks__ object
  const globalWithMocks = global as GlobalWithMocks;
  if (globalWithMocks.__mocks__ && globalWithMocks.__mocks__[request]) {
    return globalWithMocks.__mocks__[request];
  }

  return originalRequire.call(this, request);
};

// Set NODE_ENV to test
process.env.NODE_ENV = "test";

// ---- Console Mocking ----

// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

// Store captured logs for assertions
export interface CapturedLog {
  method: "log" | "error" | "warn" | "info" | "debug";
  args: any[];
}

let capturedLogs: CapturedLog[] = [];

// Silent mock implementations
console.log = function (...args: any[]) {
  capturedLogs.push({ method: "log", args });
};

console.error = function (...args: any[]) {
  capturedLogs.push({ method: "error", args });
  // Silent errors in tests - uncomment for debugging
  // originalConsole.error(...args);
};

console.warn = function (...args: any[]) {
  capturedLogs.push({ method: "warn", args });
};

console.info = function (...args: any[]) {
  capturedLogs.push({ method: "info", args });
};

console.debug = function (...args: any[]) {
  capturedLogs.push({ method: "debug", args });
};

// Export helper functions for tests
export function resetCapturedLogs() {
  capturedLogs = [];
}

export function getCapturedLogs(): CapturedLog[] {
  return capturedLogs;
}

export function logsContain(
  method: CapturedLog["method"],
  substring: string
): boolean {
  const found = capturedLogs.some(
    (log) =>
      log.method === method &&
      log.args.some((arg) => String(arg).includes(substring))
  );
  return found;
}

// Set up automatic cleanup when node process exits
process.on("exit", () => {
  // Restore original console methods
  console.log = originalConsole.log;
  console.error = originalConsole.error;
  console.warn = originalConsole.warn;
  console.info = originalConsole.info;
  console.debug = originalConsole.debug;
});
