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

  const rulesData = data
    //.filter((file: any) => file.type === "file" && file.name === ".cursorrules")
    .map((file: Record<string, unknown>) => ({
      name: file.name as string,
      downloadUrl: getRawGithubUrl(file.url as string),
      source: repoName,
    }));

  console.log("rulesData", rulesData);
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
