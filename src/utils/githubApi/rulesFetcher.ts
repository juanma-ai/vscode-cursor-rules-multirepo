import axios from "axios";
import * as vscode from "vscode";
import { workspace } from "vscode";
import { Rule } from "./types";
import { convertGithubUrlToApi, getRawGithubUrl } from "./urlUtils";
import { getGitHubApiOptions } from "./apiConfig";

/**
 * Process the API response
 * @param data - The API response data
 * @param repoName - The name of the repository
 * @returns The rules from the repository
 */
export function processApiResponse(
  data: Record<string, unknown>[],
  repoName: string
): Rule[] {
  if (!Array.isArray(data)) {
    console.error("Unexpected API response format:", data);
    return [];
  }

  console.log("Processing API response:", JSON.stringify(data, null, 2));
  console.log("Repository name:", repoName);

  const rulesData = data
    .filter((file: any) => {
      const isFile = file.type === "file";
      const isMdc = file.name.endsWith(".mdc");
      const name = file.name || "undefined";
      const type = file.type || "undefined";
      console.log(
        `Filtering file: name=${name}, type=${type}, isFile=${isFile}, isMdc=${isMdc}`
      );
      return isFile && isMdc;
    })
    .map((file: Record<string, unknown>) => {
      const rule = {
        name: file.name as string,
        downloadUrl: file.download_url as string,
        source: repoName,
      };
      console.log("Mapped rule:", JSON.stringify(rule, null, 2));
      return rule;
    });

  console.log(
    "Final processed rules data:",
    JSON.stringify(rulesData, null, 2)
  );
  return rulesData;
}

/**
 * Fetch the rules from a given repository
 * @param url - The URL of the repository
 * @param repoName - The name of the repository
 * @returns The rules from the repository
 */
export async function fetchRulesFromRepo(
  url: string,
  repoName: string
): Promise<Rule[]> {
  try {
    // Check if the URL points to .cursor/rules directory
    const isRulesDir = url.includes("/.cursor/rules");
    if (!isRulesDir) {
      console.error(`URL must point to .cursor/rules directory: ${url}`);
      vscode.window.showErrorMessage(
        `Invalid repository URL. Must point to .cursor/rules directory: ${url}`
      );
      return [];
    }

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
      console.log("API Response:", response.data);
      return processApiResponse(response.data, repoName);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 403) {
        // If rate limited, try again with token
        console.log("Rate limited, attempting with token...");
        const response = await axios.get(apiUrl, getGitHubApiOptions(true));
        console.log("API Response with token:", response.data);
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
