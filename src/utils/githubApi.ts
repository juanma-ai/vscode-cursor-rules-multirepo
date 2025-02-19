import axios from "axios";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import { Cache } from "./cache";
import * as vscode from "vscode";

export interface Rule {
  name: string;
  download_url: string;
  source: "custom" | "official";
}

const OFFICIAL_REPO_API_URL =
  "https://api.github.com/repos/PatrickJS/awesome-cursorrules/contents/rules";
const CUSTOM_REPO_API_URL =
  "https://api.github.com/repos/juanma-ai/my-cursor-rules/contents/rules";

const RULES_CACHE_KEY = "cursor_rules_list";

async function fetchRulesFromRepo(
  url: string,
  source: "custom" | "official"
): Promise<Rule[]> {
  try {
    const response = await axios.get(url);
    return response.data.map((file: any) => ({
      name: file.name,
      download_url: file.download_url,
      source,
    }));
  } catch (error) {
    console.error(`Failed to fetch rules from ${source} repository:`, error);
    return [];
  }
}

export async function fetchCursorRulesList(
  context: vscode.ExtensionContext
): Promise<Rule[]> {
  const cache = Cache.getInstance(context);
  const cachedRules = cache.get<Rule[]>(RULES_CACHE_KEY);

  const updateCache = async () => {
    try {
      // Fetch from both repositories
      const [customRules, officialRules] = await Promise.all([
        fetchRulesFromRepo(CUSTOM_REPO_API_URL, "custom"),
        fetchRulesFromRepo(OFFICIAL_REPO_API_URL, "official"),
      ]);

      // Combine rules with custom rules first
      const combinedRules = [...customRules, ...officialRules];
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

// Add type for progress
interface Progress {
  report(value: { increment?: number; message?: string }): void;
}

// Update the function signature where progress is used
export async function fetchCursorRuleContent(
  ruleName: string,
  filePath: string,
  onProgress: (progress: number) => void,
  context: vscode.ExtensionContext
): Promise<void> {
  const cache = Cache.getInstance(context);
  const rules = cache.get<Rule[]>(RULES_CACHE_KEY);
  const selectedRule = rules?.find((rule) => rule.name === ruleName);

  if (!selectedRule) {
    throw new Error("Rule not found");
  }

  const baseUrl =
    selectedRule.source === "custom"
      ? CUSTOM_REPO_API_URL
      : OFFICIAL_REPO_API_URL;
  const url = `${baseUrl}/${ruleName}/.cursorrules`;
  const initialResponse = await axios.get(url);
  const downloadUrl = initialResponse.data.download_url;

  let finalContent = "";
  const response = await axios.get(downloadUrl, { responseType: "text" });
  finalContent = response.data;

  try {
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
        finalContent = `${existingContent.trim()}\n\n${finalContent}`;
      }
    }

    await fsPromises.writeFile(filePath, finalContent);
    vscode.window.showInformationMessage(`Rules ${operation} successfully!`);
  } catch (error) {
    throw new Error(`Failed to handle file: ${error}`);
  }
}
