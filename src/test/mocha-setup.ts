/**
 * This file is used to set up the test environment before running tests.
 * It's imported by the Mocha runner.
 */

// Set up module aliases for mocks
import Module = require("module");
import path = require("path");

// Store the original require
const originalRequire = Module.prototype.require;

// Override the require function to return mocks for certain modules
Module.prototype.require = function (request: string) {
  if (request === "vscode") {
    return require("./mocks/vscode");
  }

  // Check if we have a mock for this module in the global __mocks__ object
  if ((global as any).__mocks__ && (global as any).__mocks__[request]) {
    return (global as any).__mocks__[request];
  }

  return originalRequire.call(this, request);
};

// Set NODE_ENV to test
process.env.NODE_ENV = "test";
