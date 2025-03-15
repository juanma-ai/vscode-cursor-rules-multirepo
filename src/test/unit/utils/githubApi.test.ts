import { expect } from "chai";
import * as sinon from "sinon";
import axios from "axios";
import { Cache } from "../../../utils/cache";
import * as configModule from "../../../utils/config";
import { setLogger } from "../../../utils/logger";
import { SpyLogger } from "../../mocks/logger";
import * as vscode from "vscode";

// Create a type alias for the Rule interface
// Import this after we set up the logger
let githubApiModule: typeof import("../../../utils/githubApi");
type Rule = any; // Will be properly typed after module import

// Cache key constant should match the one in the actual module
const RULES_CACHE_KEY = "cursor_rules_list";

// Helper function to reset module with our spy logger
function resetGithubApiModule() {
  // Clear require cache for the module
  const modulePath = require.resolve("../../../utils/githubApi");
  delete require.cache[modulePath];

  // Now import the module which will use our spy logger
  githubApiModule = require("../../../utils/githubApi");
}

describe("GitHub API Utilities", () => {
  let mockContext: vscode.ExtensionContext;
  let axiosStub: sinon.SinonStub;
  let configStub: sinon.SinonStub;
  let mockCache: {
    get: sinon.SinonStub;
    set: sinon.SinonStub;
  };
  // Add a spy logger for tests that need to check log messages
  let spyLogger: SpyLogger;

  beforeEach(() => {
    // Set up spy logger FIRST
    spyLogger = new SpyLogger();
    setLogger(spyLogger);

    // Reset and reload the module with our logger
    resetGithubApiModule();

    // Mock cache
    mockCache = {
      get: sinon.stub(),
      set: sinon.stub(),
    };

    // Create stub for Cache.getInstance
    sinon.stub(Cache, "getInstance").returns(mockCache as unknown as Cache);

    // Mock axios
    axiosStub = sinon.stub(axios, "get");

    // Mock config
    configStub = sinon.stub(configModule, "getConfiguredRepos");

    // Mock context
    mockContext = {
      globalState: {
        get: sinon.stub(),
        update: sinon.stub().resolves(true),
      },
    } as unknown as vscode.ExtensionContext;
  });

  afterEach(() => {
    sinon.restore();
    // Reset the spy logger
    spyLogger.reset();
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

      // Set up repo URL
      const repo = "https://github.com/user/repo/tree/main/rules";
      configStub.returns([repo]);

      // Mock API response
      const apiResponseData = [
        {
          name: "rule1.md",
          downloadUrl:
            "https://raw.githubusercontent.com/user/repo/main/rules/rule1.md",
          type: "file",
          url: "https://api.github.com/repos/user/repo/contents/rules/rule1.md",
        },
      ];

      // Configure axios to return mock data
      axiosStub.resolves({ data: apiResponseData });

      // Act
      const result = await githubApiModule.fetchCursorRulesList(mockContext);

      // Assert
      expect(result).to.be.an("array");
      expect(mockCache.get.calledWith(RULES_CACHE_KEY)).to.be.true;
      expect(configStub.calledOnce).to.be.true;
      expect(axiosStub.calledOnce).to.be.true;
      expect(mockCache.set.calledOnce).to.be.true;

      // Assert on logged messages
      expect(spyLogger.containsMessage("debug", "rulesData")).to.be.true;
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

      // Assert that the error was logged
      expect(
        spyLogger.containsMessage(
          "error",
          "Selected rule or download URL not found"
        )
      ).to.be.true;
    });
  });
});
