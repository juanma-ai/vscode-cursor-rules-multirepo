/**
 * This file is used to set up the test environment before running tests.
 * It's imported by the Mocha runner.
 */

// Import our logger and silentLogger
import { setLogger } from "../utils/logger";
import { SilentLogger } from "./mocks/logger";

// Set up module aliases for mocks
import Module = require("module");
// path is not used, removing it

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

// Use SilentLogger for all tests
setLogger(new SilentLogger());
