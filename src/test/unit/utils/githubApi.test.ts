import { expect } from "chai";
import * as sinon from "sinon";
import axios from "axios";
import { Cache } from "../../../utils/cache";
import * as configModule from "../../../utils/config";
import * as githubApiModule from "../../../utils/githubApi";
import * as vscode from "vscode";
import {
  logsContain,
  resetCapturedLogs,
  getCapturedLogs,
} from "../../mocha-setup";
import { convertGithubUrlToApi } from "../../../utils/githubApi/urlUtils";

// Create a type alias for the Rule interface
type Rule = githubApiModule.Rule;

// Cache key constant should match the one in the actual module
const RULES_CACHE_KEY = "cursor_rules_list";

describe("GitHub API Utilities", () => {
  let mockContext: vscode.ExtensionContext;
  let axiosStub: sinon.SinonStub;
  let configStub: sinon.SinonStub;
  let mockCache: {
    get: sinon.SinonStub;
    set: sinon.SinonStub;
  };

  beforeEach(() => {
    // Reset captured logs before each test
    resetCapturedLogs();

    // Mock cache
    mockCache = {
      get: sinon.stub(),
      set: sinon.stub().resolves(undefined),
    };

    // Create stub for Cache.getInstance
    sinon.stub(Cache, "getInstance").returns(mockCache as unknown as Cache);

    // Mock axios
    axiosStub = sinon.stub(axios, "get");

    // Mock config
    configStub = sinon.stub(configModule, "getConfiguredRepos");

    // Mock context with proper globalState
    mockContext = {
      globalState: {
        get: sinon.stub(),
        update: sinon.stub().resolves(undefined),
        setKeysForSync: sinon.stub(),
      },
    } as unknown as vscode.ExtensionContext;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("fetchCursorRulesList", () => {
    it("should return cached data if available", async () => {
      // Arrange
      const cachedRules: Rule[] = [
        {
          name: "rule1.json",
          downloadUrl: "https://example.com/rule1.json",
          source: "repo1",
        },
      ];

      // Set up cache to return data for the specific cache key
      mockCache.get.withArgs(RULES_CACHE_KEY).returns(cachedRules);

      // Act
      const result = await githubApiModule.fetchCursorRulesList(mockContext);

      // Assert
      expect(result).to.deep.equal(cachedRules);
      expect(mockCache.get.calledWith(RULES_CACHE_KEY)).to.be.true;
    });

    it("should fetch and cache rules when cache is empty", async () => {
      // Arrange
      // Cache returns null for the specific key
      mockCache.get.withArgs(RULES_CACHE_KEY).returns(null);

      // Set up repo URL pointing to .cursor/rules directory
      const repo = "https://github.com/user/repo/tree/main/.cursor/rules";
      configStub.returns([repo]);
      console.log("Configured repo URL:", repo);

      // Mock API response with .mdc files
      const apiResponseData = [
        {
          name: "rule1.mdc",
          type: "file",
          url: "https://api.github.com/repos/user/repo/contents/.cursor/rules/rule1.mdc",
          download_url:
            "https://raw.githubusercontent.com/user/repo/main/.cursor/rules/rule1.mdc",
        },
      ];

      // Configure axios to return mock data
      axiosStub.resolves({ data: apiResponseData });
      console.log("Mock API response data:", apiResponseData);

      // Mock cache.set to resolve immediately
      mockCache.set.resolves(undefined);

      // Act
      const result = await githubApiModule.fetchCursorRulesList(mockContext);
      console.log("Test result:", result);
      console.log(
        "Axios calls:",
        axiosStub.getCalls().map((call) => ({
          url: call.args[0],
          options: call.args[1],
        }))
      );
      console.log("Captured logs:", getCapturedLogs());

      // Assert axios call
      expect(axiosStub.calledOnce).to.be.true;
      const axiosCall = axiosStub.getCall(0);
      expect(axiosCall.args[0]).to.equal(
        "https://api.github.com/repos/user/repo/contents/.cursor/rules"
      );
      console.log(
        "Expected axios URL:",
        "https://api.github.com/repos/user/repo/contents/.cursor/rules"
      );
      console.log("Actual axios URL:", axiosCall.args[0]);

      // Assert result
      expect(result).to.be.an("array");
      expect(result.length, "Expected result array to have 1 item").to.equal(1);
      expect(result[0].name).to.equal("rule1.mdc");
      expect(result[0].downloadUrl).to.equal(
        "https://raw.githubusercontent.com/user/repo/main/.cursor/rules/rule1.mdc"
      );
      expect(result[0].source).to.equal("user/repo");
      expect(mockCache.get.calledWith(RULES_CACHE_KEY)).to.be.true;
      expect(configStub.calledOnce).to.be.true;
      expect(mockCache.set.calledOnce).to.be.true;

      // Assert on logged messages using our console mock
      expect(logsContain("log", "Final processed rules data")).to.be.true;
    });

    it("should return empty array if URL does not point to .cursor/rules directory", async () => {
      // Arrange
      mockCache.get.withArgs(RULES_CACHE_KEY).returns(null);
      const repo = "https://github.com/user/repo/tree/main/rules";
      configStub.returns([repo]);

      // Act
      const result = await githubApiModule.fetchCursorRulesList(mockContext);

      // Assert
      expect(result).to.be.an("array");
      expect(result.length).to.equal(0);
      expect(logsContain("error", "URL must point to .cursor/rules directory"))
        .to.be.true;
    });
  });

  describe("fetchCursorRuleContent", () => {
    it("should throw error if rule is not found", async () => {
      // Arrange
      const mockRules: Rule[] = [
        {
          name: "rule1.json",
          downloadUrl: "https://example.com/rule1.json",
          source: "repo1",
        },
      ];

      mockCache.get.withArgs(RULES_CACHE_KEY).returns(mockRules);

      const progressCallback = sinon.stub();

      // Act & Assert
      let error: Error | null = null;
      try {
        await githubApiModule.fetchCursorRuleContent(
          "nonexistent.json",
          "/test/path/file.cursorrules", // use any path, we'll throw before file operations
          progressCallback,
          mockContext
        );
      } catch (err) {
        error = err as Error;
      }

      // Assert
      expect(error).to.not.be.null;
      expect(error?.message).to.include("Rule not found");

      // Verify mocks
      expect(mockCache.get.calledWith(RULES_CACHE_KEY)).to.be.true;
      expect(axiosStub.called).to.be.false; // Should not call axios if rule is not found

      // Assert that the error was logged using our console mock
      expect(logsContain("error", "Selected rule or download URL not found")).to
        .be.true;
    });
  });

  describe("convertGithubUrlToApi", () => {
    it("should convert GitHub URL with .cursor/rules path correctly", () => {
      const githubUrl = "https://github.com/user/repo/tree/main/.cursor/rules";
      const expectedApiUrl =
        "https://api.github.com/repos/user/repo/contents/.cursor/rules";
      const result = convertGithubUrlToApi(githubUrl);
      expect(result).to.equal(expectedApiUrl);
    });
  });
});
