import * as vscode from 'vscode';
import { fetchCursorRulesList, fetchCursorRuleContent } from '../utils/githubApi';
import * as path from 'path';

export async function addCursorRuleCommand() {
    try {
        const quickPick = vscode.window.createQuickPick();
        quickPick.placeholder = 'Loading...';
        quickPick.show();

        let rules = [];
        try {
            rules = await fetchCursorRulesList();
        } catch (error) {
            vscode.window.showErrorMessage('Error loading rules list.');
            quickPick.hide();
            return;
        }

        const ruleNames = rules.map(rule => rule.name);
        quickPick.items = ruleNames.map(name => ({ label: name }));
        quickPick.placeholder = 'Select a rule file';

        const selected = await new Promise<string | undefined>(resolve => {
            quickPick.onDidAccept(() => {
                const selection = quickPick.selectedItems[0]?.label;
                resolve(selection);
                quickPick.hide();
            });
            quickPick.onDidHide(() => {
                resolve(undefined);
            });
        });

        if (!selected) {
            vscode.window.showInformationMessage('No rules selected.');
            return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            vscode.window.showErrorMessage('Please open a workspace first.');
            return;
        }

        const workspacePath = workspaceFolders[0].uri.fsPath;
        const filePath = path.join(workspacePath, '.cursorrules');

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Downloading ${selected}...`,
            cancellable: false
        }, async (progress) => {
            await fetchCursorRuleContent(selected, filePath, (percent) => {
                progress.report({ increment: percent });
            });
        });

        vscode.window.showInformationMessage(`.cursorrules file added to ${workspacePath}`);
    } catch (error) {
        vscode.window.showErrorMessage(`Error adding rule file: ${error}`);
    }
} 