import * as fsPromises from "fs/promises";
import * as vscode from "vscode";
import { Cache } from "../cache";
import { getConfiguredRepos } from "../config";
import { Rule, RULES_CACHE_KEY } from "./types";
import { getRepoIdentifier } from "./urlUtils";
import { fetchRulesFromRepo } from "./rulesFetcher";
import { getGitHubApiOptions } from "./apiConfig";
import axios from "axios";
import path from "path";
import { workspace } from "vscode";
import { saveRuleFile } from "./fileOperations";

/**
 * Fetch the cursor rules list
 * @param context - The extension context
 * @returns The cursor rules list
 */
export async function fetchCursorRulesList(
  context: vscode.ExtensionContext
): Promise<Rule[]> {
  const cache = Cache.getInstance(context);
  const cachedRules = cache.get<Rule[]>(RULES_CACHE_KEY);

  const updateCache = async (): Promise<Rule[]> => {
    try {
      const repos = getConfiguredRepos();
      if (!repos || !Array.isArray(repos)) {
        console.error("Invalid or empty repos configuration");
        return [];
      }

      const rulesPromises = repos.map((repoUrl) =>
        fetchRulesFromRepo(repoUrl, getRepoIdentifier(repoUrl))
      );

      const repoResults = await Promise.all(rulesPromises);
      const combinedRules = repoResults.flat();
      console.log("Setting cache with combined rules:", combinedRules);
      await cache.set(RULES_CACHE_KEY, combinedRules);
      return combinedRules;
    } catch (error) {
      console.error("Cache update failed:", error);
      return [];
    }
  };

  if (cachedRules) {
    console.log("Found cached rules:", cachedRules);
    // Don't await the cache update, let it run in the background
    updateCache().catch((error) => {
      console.error("Background cache update failed:", error);
    });
    return cachedRules;
  }

  console.log("No cached rules found, fetching...");
  const updatedRules = await updateCache();
  console.log("Fetched rules:", updatedRules);
  return updatedRules;
}

/**
 * Fetch the content of a cursor rule
 * @param ruleName - The name of the rule
 * @param filePath - The path to the file
 * @param onProgress - The function to call with the progress
 * @param context - The extension context
 */
export async function fetchCursorRuleContent(
  ruleName: string,
  filePath: string,
  onProgress: (progress: number) => void,
  context: vscode.ExtensionContext
): Promise<void> {
  try {
    const cache = Cache.getInstance(context);
    const rules = cache.get<Rule[]>(RULES_CACHE_KEY);
    const selectedRule = rules?.find((rule) => rule.name === ruleName);

    if (!selectedRule || !selectedRule.downloadUrl) {
      console.error("Selected rule or download URL not found:", {
        ruleName,
        selectedRule,
      });
      throw new Error("Rule not found or invalid download URL");
    }

    console.log("----fetchCursorRuleContent");
    console.log({
      ruleName,
      filePath,
      onProgress,
      context,
    });

    console.log("Fet__ching rule content from:", selectedRule.downloadUrl);
    const response = await axios.get(selectedRule.downloadUrl, {
      ...getGitHubApiOptions(),
      responseType: "text",
    });
    const finalContent = response.data;

    // Get the workspace folder
    const workspaceFolder = workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error("No workspace folder found");
    }

    const ruleFilePath = await saveRuleFile(
      workspaceFolder,
      ruleName,
      finalContent
    );

    vscode.window.showInformationMessage(
      `Rule saved successfully to ${ruleFilePath}!`
    );
  } catch (error) {
    console.error("Error in fetchCursorRuleContent:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to handle file: ${error.message}`);
    }
    throw new Error("Failed to handle file: Unknown error");
  }
}
