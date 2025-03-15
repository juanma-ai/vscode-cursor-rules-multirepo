import * as fsPromises from "fs/promises";
import * as vscode from "vscode";
import { Cache } from "../cache";
import { getConfiguredRepos } from "../config";
import { Rule, RULES_CACHE_KEY } from "./types";
import { getRepoIdentifier } from "./urlUtils";
import { fetchRulesFromRepo } from "./rulesFetcher";
import { getGitHubApiOptions } from "./apiConfig";
import axios from "axios";

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

  const updateCache = async () => {
    try {
      const repos = getConfiguredRepos();
      if (!repos || !Array.isArray(repos)) {
        console.error("Invalid or empty repos configuration");
        return;
      }

      const rulesPromises = repos.map((repoUrl) =>
        fetchRulesFromRepo(repoUrl, getRepoIdentifier(repoUrl))
      );

      const repoResults = await Promise.all(rulesPromises);
      const combinedRules = repoResults.flat();
      cache.set(RULES_CACHE_KEY, combinedRules);
    } catch (error) {
      console.error("Cache update failed:", error);
    }
  };

  if (cachedRules) {
    updateCache(); // Update cache in background
    return cachedRules;
  }

  await updateCache();
  return cache.get<Rule[]>(RULES_CACHE_KEY) || [];
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

    console.log("Fetching rule content from:", selectedRule.downloadUrl);
    const response = await axios.get(selectedRule.downloadUrl, {
      ...getGitHubApiOptions(),
      responseType: "text",
    });
    const finalContent = response.data;

    const fileExists = await fsPromises
      .access(filePath)
      .then(() => true)
      .catch(() => false);

    let operation = "created";
    if (fileExists) {
      const choice = await vscode.window.showQuickPick(
        [
          { label: "Append", description: "Add to existing rules" },
          { label: "Overwrite", description: "Replace existing rules" },
        ],
        {
          placeHolder: "How would you like to handle existing .cursorrules?",
        }
      );

      if (!choice) {
        return; // User cancelled
      }

      operation = `${choice.label.toLowerCase()}d`;
      if (choice.label === "Append") {
        const existingContent = await fsPromises.readFile(filePath, "utf-8");
        const newContent = `${existingContent.trim()}\n\n${finalContent}`;
        await fsPromises.writeFile(filePath, newContent);
      } else {
        await fsPromises.writeFile(filePath, finalContent);
      }
    } else {
      await fsPromises.writeFile(filePath, finalContent);
    }

    vscode.window.showInformationMessage(`Rules ${operation} successfully!`);
  } catch (error) {
    console.error("Error in fetchCursorRuleContent:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to handle file: ${error.message}`);
    }
    throw new Error("Failed to handle file: Unknown error");
  }
}
