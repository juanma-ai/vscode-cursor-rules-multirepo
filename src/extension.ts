import * as vscode from "vscode";
import { addCursorRuleCommand } from "./commands/addCursorRule";
import { Cache } from "./utils/cache";

export function activate(context: vscode.ExtensionContext) {
  Cache.getInstance(context);

  // Force configuration reload
  const config = vscode.workspace.getConfiguration("cursorRules");
  config.update(
    "repos",
    config.get("repos"),
    vscode.ConfigurationTarget.Workspace
  );

  let disposable = vscode.commands.registerCommand(
    "cursorRules.addRule",
    () => {
      return addCursorRuleCommand(context);
    }
  );
  context.subscriptions.push(disposable);
}

export function deactivate() {}
