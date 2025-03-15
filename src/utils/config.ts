import * as vscode from "vscode";

/**
 * Get the configured repositories from the workspace configuration
 * @returns An array of repository URLs
 */
export function getConfiguredRepos(): string[] {
  const config = vscode.workspace.getConfiguration();

  const inspectRepos = config.inspect("cursorRules.repos");

  console.log("Global value:", inspectRepos?.globalValue);
  console.log("Workspace value:", inspectRepos?.workspaceValue);
  console.log("Default value:", inspectRepos?.defaultValue);

  const repos =
    (inspectRepos?.workspaceValue as string[]) ||
    (inspectRepos?.globalValue as string[]) ||
    (inspectRepos?.defaultValue as string[]);

  return repos;
}
