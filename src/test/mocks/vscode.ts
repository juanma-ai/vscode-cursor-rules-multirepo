/**
 * Mock for the vscode module
 */

// Global namespace that would be provided by VS Code
const vscode = {
  workspace: {
    getConfiguration: () => ({
      get: (key: string) => {
        if (key === "cursorRules.repos") {
          return ["https://github.com/testuser/testrepo"];
        }
        if (key === "cursorRules.githubToken") {
          return "test-token";
        }
        return undefined;
      },
      inspect: (key: string) => {
        if (key === "cursorRules.repos") {
          return {
            globalValue: ["https://github.com/testuser/testrepo"],
            workspaceValue: undefined,
            defaultValue: ["https://github.com/default/repo"],
          };
        }
        return undefined;
      },
    }),
  },
  window: {
    createQuickPick: () => ({
      placeholder: "",
      show: () => {},
      hide: () => {},
      onDidAccept: (callback: () => void) => {
        callback();
        return { dispose: () => {} };
      },
      onDidHide: (callback: () => void) => {
        callback();
        return { dispose: () => {} };
      },
      items: [],
      selectedItems: [],
    }),
    showErrorMessage: () => {},
    showInformationMessage: () => {},
    withProgress: async (options: any, task: any) => {
      return task({
        report: () => {},
      });
    },
  },
  commands: {
    registerCommand: (command: string, callback: () => void) => {
      return { dispose: () => {} };
    },
  },
  ProgressLocation: {
    Notification: 1,
  },
  Uri: {
    file: (path: string) => ({ fsPath: path }),
  },
  EventEmitter: class {
    event: any;
    constructor() {
      this.event = () => {};
    }
    fire() {}
  },
};

export = vscode;
