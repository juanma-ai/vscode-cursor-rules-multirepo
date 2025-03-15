# Testing Documentation

This document provides an overview of the testing infrastructure used in this VS Code extension.

## Overview of the `src/test` Folder

The `src/test` folder contains the testing infrastructure for this VS Code extension. It's organized into several key components that enable efficient and comprehensive testing of the extension's functionality.

## Main Configuration Files

### `mocha-setup.ts`

- Sets up the test environment before running tests
- Configures module mocking by overriding Node's `require` function
- Intercepts imports for `vscode` to provide a mock implementation
- Supports global mocks via a `__mocks__` object
- Sets `NODE_ENV` to "test"

### `runTest.ts`

- Responsible for executing the test suite
- Uses `vscode-test` to download and run VS Code for testing
- Sets up paths to the extension and test files
- Runs integration tests within a VS Code environment

## Test Directories

### `mocks/`

- Contains mock implementations for external dependencies
- Has `vscode.ts` (152 lines) which provides a mock implementation of the VS Code API
- This allows tests to run without requiring an actual VS Code instance

### `unit/`

- Contains unit tests for individual components
- Has `extension.test.ts` for testing the main extension functionality
- Includes a `utils/` subdirectory likely containing tests for utility functions

### `suite/`

- Contains the test suite configuration
- Has `index.ts` (43 lines) which sets up and organizes test execution

### `integration/`

- This directory is currently empty
- Likely intended for future integration tests that would test the extension in a more realistic environment

## Testing Approach

This testing structure follows a common pattern for VS Code extensions:

- **Unit tests** for testing individual components in isolation
- A **test suite configuration** for organizing test execution
- **Mocks** to simulate VS Code APIs without needing a running instance
- Support for **integration tests** to verify the extension works correctly within VS Code

The empty `integration` directory suggests that integration testing might be planned but not yet implemented, or it could be a placeholder for future test development.

## Running Tests

To run the tests, you can use the following npm scripts (defined in package.json):

- `npm test` - Runs all tests
- `npm run unit-test` - Runs only unit tests (if available)
- `npm run integration-test` - Runs only integration tests (if available)

## Test Framework

This project uses Mocha as the test framework and likely uses assertion libraries like Chai or standard Node.js assertions for test assertions.

## Unit Tests & Integration Tests

This project employs a dual testing strategy that includes both unit tests and integration tests, each serving a different purpose:

### `src/test/mocks/vscode.ts` - For Unit Testing

The `vscode.ts` mock provides a simulated VS Code API environment for unit testing:

- Enables **fast execution** of tests without launching VS Code
- Creates **predictable test conditions** with controlled responses
- Allows testing of **isolated components** without external dependencies
- Provides implementations for VS Code-specific functionality:
  - Configuration settings (`workspace.getConfiguration()`)
  - UI components (`window.createQuickPick()`)
  - Command registration (`commands.registerCommand()`)
  - Extension context (`ExtensionContext`)
  - State management (`Memento` class)

### `src/test/runTest.ts` - For Integration Testing

This file handles integration testing with a real VS Code instance:

- **Downloads and launches** an actual VS Code instance
- Tests the extension in a **real environment**
- Verifies end-to-end functionality as a user would experience it
- Catches issues that might only appear in the real VS Code environment

The key part of `runTest.ts` is:

```typescript
await vscode.runTests({
  extensionDevelopmentPath,
  extensionTestsPath,
});
```

This uses the `vscode-test` package to launch a real VS Code instance with the extension loaded.

### Why Both Approaches Are Necessary

This combined approach follows testing best practices:

1. **Unit Tests** (with mocks):

   - Fast feedback loop during development
   - Precise testing of specific code paths
   - Can run anywhere without special setup
   - Great for testing business logic and individual functions

2. **Integration Tests** (with real VS Code):
   - More realistic testing environment
   - Validates the extension works with actual VS Code APIs
   - Tests user workflows end-to-end
   - Catches integration issues that mocks might miss
