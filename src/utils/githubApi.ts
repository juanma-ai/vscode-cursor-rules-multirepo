import axios from "axios";
import * as fs from "fs";
import * as fsPromises from "fs/promises";
import { Cache } from "./cache";
import * as vscode from "vscode";
import { getConfiguredRepos } from "./config";
import { workspace } from "vscode";

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

function getRawGithubUrl(url: string): string {
  try {
    const urlObj = new URL(url);

    // Handle if it's already a raw URL
    if (urlObj.hostname === "raw.githubusercontent.com") {
      return url;
    }

    // Handle API URL conversion
    if (urlObj.hostname === "api.github.com") {
      // Extract the components from the API URL
      const parts = urlObj.pathname.split("/");
      const owner = parts[2];
      const repo = parts[3];
      const path = parts.slice(5).join("/");

      return `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/main/${path}/.cursorrules`;
    }

    // Handle regular GitHub URL
    const parts = urlObj.pathname.split("/");
    const owner = parts[1];
    const repo = parts[2];
    const path = parts.slice(4).join("/");

    return `https://raw.githubusercontent.com/${owner}/${repo}/refs/heads/main/${path}/.cursorrules`;
  } catch (error) {
    console.error("Error converting to raw URL:", error);
    return url; // Return original URL if conversion fails
  }
}

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

interface GitHubApiOptions {
  headers: {
    Authorization?: string;
    Accept: string;
  };
}

function getGitHubApiOptions(useToken: boolean = false): GitHubApiOptions {
  const headers: GitHubApiOptions["headers"] = {
    Accept: "application/vnd.github.v3+json",
  };

  if (useToken) {
    const config = workspace.getConfiguration("cursorRules");
    const token = config.get<string>("githubToken");
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  return { headers };
}

async function fetchRulesFromRepo(
  url: string,
  repoName: string
): Promise<Rule[]> {
  try {
    const apiUrl = convertGithubUrlToApi(url);
    if (!apiUrl) {
      console.error(`Failed to convert URL: ${url}`);
      vscode.window.showErrorMessage(`Invalid GitHub repository URL: ${url}`);
      return [];
    }

    console.log("Fetching from API URL:", apiUrl);

    // First try without token
    try {
      const response = await axios.get(apiUrl, getGitHubApiOptions(false));
      return processApiResponse(response.data, repoName);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        // If rate limited, try again with token
        console.log("Rate limited, attempting with token...");
        const response = await axios.get(apiUrl, getGitHubApiOptions(true));
        return processApiResponse(response.data, repoName);
      }
      throw error; // Re-throw if it's not a rate limit error
    }
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      const message = error.response.data?.message || "Rate limit exceeded";
      const config = workspace.getConfiguration("cursorRules");
      const hasToken = config.get<string>("githubToken");

      if (!hasToken) {
        vscode.window.showErrorMessage(
          `GitHub API: ${message}. To increase rate limits, please configure a GitHub token in settings:
          1. Open Settings (Cmd/Ctrl + ,)
          2. Search for "cursorRules.githubToken"
          3. Add your GitHub Personal Access Token`
        );
      } else {
        vscode.window.showErrorMessage(
          `GitHub API: ${message}. Please check if your token has correct permissions or try again later.`
        );
      }
    } else {
      vscode.window.showErrorMessage(
        `Failed to fetch rules from ${repoName}: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
    console.error(`Failed to fetch rules from ${repoName}:`, error);
    return [];
  }
}

// Helper function to process API response
function processApiResponse(data: any, repoName: string): Rule[] {
  if (!Array.isArray(data)) {
    console.error("Unexpected API response format:", data);
    return [];
  }

  const rulesData = data
    //.filter((file: any) => file.type === "file" && file.name === ".cursorrules")
    .map((file: any) => ({
      name: file.name,
      download_url: getRawGithubUrl(file.url),
      source: repoName,
    }));

  console.log("rulesData", rulesData);
  return rulesData;
}

export async function fetchCursorRulesList(
  context: vscode.ExtensionContext
): Promise<Rule[]> {
  const cache = Cache.getInstance(context);
  const cachedRules = cache.get<Rule[]>(RULES_CACHE_KEY);

  const updateCache = async () => {
    try {
      const repos = getConfiguredRepos();
      const repoNames = repos.map(getRepoIdentifier);

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
  try {
    const cache = Cache.getInstance(context);
    const rules = cache.get<Rule[]>(RULES_CACHE_KEY);
    const selectedRule = rules?.find((rule) => rule.name === ruleName);

    if (!selectedRule || !selectedRule.download_url) {
      console.error("Selected rule or download URL not found:", {
        ruleName,
        selectedRule,
      });
      throw new Error("Rule not found or invalid download URL");
    }

    console.log("Fetching rule content from:", selectedRule.download_url);
    const response = await axios.get(selectedRule.download_url, {
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

// export async function fetchRulesFromRepos(): Promise<GithubContent[]> {
//   try {
//     const repos = getConfiguredRepos();
//     const allRules: GithubContent[] = [];

//     for (const repoUrl of repos) {
//       const apiUrl = convertGithubUrlToApi(repoUrl);
//       if (!apiUrl) {
//         vscode.window.showWarningMessage(`Invalid repository URL: ${repoUrl}`);
//         continue;
//       }

//       try {
//         const rules = await fetchGithubContents(apiUrl);
//         allRules.push(...rules);
//       } catch (error) {
//         const errorMessage =
//           error instanceof Error ? error.message : "Unknown error";
//         vscode.window.showWarningMessage(
//           `Failed to fetch rules from ${repoUrl}: ${errorMessage}`
//         );
//       }
//     }

//     return allRules;
//   } catch (error) {
//     const errorMessage =
//       error instanceof Error ? error.message : "Unknown error";
//     throw new Error(`Failed to fetch rules: ${errorMessage}`);
//   }
// }

function convertGithubUrlToApi(githubUrl: string): string | null {
  try {
    const url = new URL(githubUrl);

    // If it's already an API URL, return it
    if (url.hostname === "api.github.com") {
      return githubUrl;
    }

    // Handle github.com URLs
    if (url.hostname === "github.com") {
      const pathParts = url.pathname.split("/").filter(Boolean);

      // We need at least owner/repo
      if (pathParts.length < 2) {
        console.error("Invalid GitHub URL format - need at least owner/repo");
        return null;
      }

      const [owner, repo, ...rest] = pathParts;

      // Handle tree/blob/raw paths
      let path = "";
      if (rest.length > 0) {
        const treeIndex = rest.indexOf("tree");
        const blobIndex = rest.indexOf("blob");
        const startIndex = Math.max(treeIndex, blobIndex);

        if (startIndex !== -1 && rest.length > startIndex + 1) {
          // Skip the 'tree' or 'blob' part and the branch name
          path = rest.slice(startIndex + 2).join("/");
        } else {
          path = rest.join("/");
        }
      }

      const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      console.log("Converted URL:", apiUrl);
      return apiUrl;
    }

    console.error("Not a GitHub URL");
    return null;
  } catch (error) {
    console.error("Error converting GitHub URL:", error);
    return null;
  }
}
