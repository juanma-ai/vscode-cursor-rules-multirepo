import { expect } from "chai";
import * as sinon from "sinon";
import { Cache } from "../../../utils/cache";
import * as vscode from "vscode";

describe("Cache", () => {
  let mockContext: vscode.ExtensionContext;
  let mockGlobalState: {
    update: sinon.SinonStub;
    get: sinon.SinonStub;
  };
  let cacheInstance: Cache;

  beforeEach(() => {
    // Reset the singleton instance
    (Cache as any).instance = undefined;

    // Create mock VSCode extension context
    mockGlobalState = {
      update: sinon.stub().resolves(),
      get: sinon.stub(),
    };

    mockContext = {
      globalState: mockGlobalState as any,
    } as vscode.ExtensionContext;

    // Get a fresh instance
    cacheInstance = Cache.getInstance(mockContext);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("getInstance", () => {
    it("should return the same instance when called multiple times", () => {
      const instance1 = Cache.getInstance(mockContext);
      const instance2 = Cache.getInstance(mockContext);

      expect(instance1).to.equal(instance2);
    });
  });

  describe("set", () => {
    it("should update the globalState with the provided key and value", () => {
      const key = "testKey";
      const value = { data: "testValue" };

      cacheInstance.set(key, value);

      expect(mockGlobalState.update.calledOnce).to.be.true;
      expect(mockGlobalState.update.firstCall.args[0]).to.equal(key);
      expect(mockGlobalState.update.firstCall.args[1]).to.deep.equal(value);
    });
  });

  describe("get", () => {
    it("should retrieve the value from globalState for the provided key", () => {
      const key = "testKey";
      const expectedValue = { data: "testValue" };

      mockGlobalState.get.withArgs(key).returns(expectedValue);

      const result = cacheInstance.get(key);

      expect(result).to.deep.equal(expectedValue);
      expect(mockGlobalState.get.calledOnce).to.be.true;
      expect(mockGlobalState.get.firstCall.args[0]).to.equal(key);
    });

    it("should return null if the key does not exist in globalState", () => {
      const key = "nonExistentKey";

      mockGlobalState.get.withArgs(key).returns(undefined);

      const result = cacheInstance.get(key);

      expect(result).to.be.null;
      expect(mockGlobalState.get.calledOnce).to.be.true;
      expect(mockGlobalState.get.firstCall.args[0]).to.equal(key);
    });
  });
});
