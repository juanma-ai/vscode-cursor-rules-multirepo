import * as vscode from "vscode";
import { addCursorRuleCommand } from "./commands/addCursorRule";
import { Cache } from "./utils/cache";

export function activate(context: vscode.ExtensionContext) {
  Cache.getInstance(context);

  const disposable = vscode.commands.registerCommand(
    "cursorRules.addRule",
    () => {
      return addCursorRuleCommand(context);
    }
  );
  context.subscriptions.push(disposable);
}

// This function is called when the extension is deactivated
export function deactivate() {
  // Nothing to clean up
}
