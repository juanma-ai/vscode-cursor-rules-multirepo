import axios from "axios";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import { Cache } from "./cache";
import * as vscode from "vscode";
import { getConfiguredRepos } from "./config";

export interface Rule {
  name: string;
  download_url: string;
  source: string;
}

export interface GithubContent {
  name: string;
  path: string;
  download_url: string;
  type: string;
}

const RULES_CACHE_KEY = "cursor_rules_list";

// Move getRepoIdentifier to module scope
function getRepoIdentifier(url: string): string {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === "github.com") {
      // Extract owner/repo from github.com URLs
      const [, owner, repo] = urlObj.pathname.split("/");
      return `${owner}/${repo}`;
    } else if (urlObj.hostname === "api.github.com") {
      // Extract owner/repo from api.github.com URLs
      const [, , , owner, repo] = urlObj.pathname.split("/");
      return `${owner}/${repo}`;
    }
    return "unknown-repository";
  } catch {
    return "invalid-url";
  }
}

async function fetchRulesFromRepo(
  url: string,
  repoName: string
): Promise<Rule[]> {
  try {
    const apiUrl = convertGithubUrlToApi(url);
    if (!apiUrl) {
      throw new Error(`Invalid repository URL: ${url}`);
    }

    const contents = await fetchGithubContents(apiUrl);
    return contents.map((file) => ({
      name: file.name,
      download_url: file.download_url,
      source: repoName,
    }));
  } catch (error) {
    console.error(`Failed to fetch rules from ${repoName}:`, error);
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
      const repos = getConfiguredRepos();
      // Extract repository names from URLs for better identification
      const repoNames = repos.map(getRepoIdentifier);
      console.log("Repository identifiers:", repoNames);

      const rulesPromises = repos.map((repoUrl) =>
        // Use the repository identifier as the source name
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

  // Get the repository URL by matching the source name
  const repos = getConfiguredRepos();
  const repoUrl = repos.find(
    (url) => getRepoIdentifier(url) === selectedRule.source
  );

  if (!repoUrl) {
    throw new Error("Repository not found");
  }

  const apiUrl = convertGithubUrlToApi(repoUrl);
  if (!apiUrl) {
    throw new Error("Invalid repository URL");
  }

  const url = `${apiUrl}/${ruleName}/.cursorrules`;
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

async function fetchGithubContents(apiUrl: string): Promise<GithubContent[]> {
  try {
    const response = await axios.get(apiUrl);
    if (!Array.isArray(response.data)) {
      return [];
    }

    const allContents: GithubContent[] = [];

    for (const item of response.data) {
      if (item.type === "dir") {
        // Recursively fetch contents of directories
        const subContents = await fetchGithubContents(item.url);
        allContents.push(...subContents);
      } else if (item.type === "file" && item.name === ".cursorrules") {
        // Only include .cursorrules files
        allContents.push(item);
      }
    }

    return allContents;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to fetch contents: ${error.message}`);
    }
    throw new Error("Failed to fetch contents");
  }
}

export async function fetchRulesFromRepos(): Promise<GithubContent[]> {
  try {
    const repos = getConfiguredRepos();
    const allRules: GithubContent[] = [];

    for (const repoUrl of repos) {
      const apiUrl = convertGithubUrlToApi(repoUrl);
      if (!apiUrl) {
        vscode.window.showWarningMessage(`Invalid repository URL: ${repoUrl}`);
        continue;
      }

      try {
        const rules = await fetchGithubContents(apiUrl);
        allRules.push(...rules);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        vscode.window.showWarningMessage(
          `Failed to fetch rules from ${repoUrl}: ${errorMessage}`
        );
      }
    }

    return allRules;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to fetch rules: ${errorMessage}`);
  }
}

function convertGithubUrlToApi(githubUrl: string): string | null {
  try {
    const url = new URL(githubUrl);
    const pathParts = url.pathname.split("/");

    // Remove empty strings and 'tree' from path
    const cleanParts = pathParts.filter((part) => part && part !== "tree");

    if (cleanParts.length < 4) {
      return null;
    }

    const [owner, repo, ...pathRest] = cleanParts;
    const branch = pathRest.shift(); // Remove branch name
    const path = pathRest.join("/");

    return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  } catch (error) {
    return null;
  }
}
