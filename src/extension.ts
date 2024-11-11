import * as vscode from 'vscode';
import { addCursorRuleCommand } from './commands/addCursorRule';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('cursorRules.addRule', addCursorRuleCommand);
    context.subscriptions.push(disposable);
}

export function deactivate() {} 