import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Removed fileURLToPath and URL for simpler dynamic imports of local files.

// Helper to dynamically import CJS and ESM modules
async function importModule(modulePath: string) {
  if (modulePath.endsWith(".cjs")) {
    // For CommonJS modules, require directly.
    return require(modulePath);
  } else {
    // For ESM modules, use dynamic import.
    return await import(modulePath);
  }
}

describe("Code Configurations Imports", () => {
  it("should import vitest.config.cjs without errors and check basic structure", async () => {
    const vitestConfigPath = path.join(process.cwd(), "vitest.config.cjs");
    const configModule = await importModule(vitestConfigPath);
    expect(configModule).toBeDefined();
    // vitest.config.cjs exports an object directly, not a default export.
    expect(configModule.test).toBeDefined();
  });

  it("should import tsup.config.ts without errors and check basic structure", async () => {
    const tsupConfigPath = path.join(process.cwd(), "tsup.config.cjs");
    // Using import() directly for ESM
    const configModule = await import(tsupConfigPath);
    expect(configModule).toBeDefined();
    expect(configModule.default).toBeDefined();
    expect(configModule.default.entry).toBeDefined();
  });

  it("should import snodeb.config.ts without errors and check basic structure", async () => {
    const snodebConfigPath = path.join(process.cwd(), "snodeb.config.cjs");
    // Using import() directly for ESM
    const configModule = await import(snodebConfigPath);
    expect(configModule).toBeDefined();
    expect(configModule.default).toBeDefined();
    expect(configModule.default.files).toBeDefined();
  });

  it("should import commitlint.config.ts without errors", async () => {
    const commitlintConfigPath = path.join(process.cwd(), "commitlint.config.cjs");
    const configModule = await import(commitlintConfigPath);
    expect(configModule).toBeDefined();
    expect(configModule.default).toBeDefined();
    expect(configModule.default.extends).toBeDefined();
  });
});

const rootDir = process.cwd();

describe("JSON Configurations", () => {
  it("should validate biome.json", () => {
    const content = fs.readFileSync(path.join(rootDir, "biome.json"), "utf-8");
    const json = JSON.parse(content);
    expect(json).toHaveProperty("$schema");
    expect(json.formatter).toBeDefined();
    expect(json.vcs).toBeDefined();
  });

  it("should validate .releaserc.json", () => {
    const content = fs.readFileSync(path.join(rootDir, ".releaserc.json"), "utf-8");
    const json = JSON.parse(content);
    expect(Array.isArray(json.branches)).toBe(true);
    expect(Array.isArray(json.plugins)).toBe(true);
  });

  it("should validate .releaserc.helm.json", () => {
    const content = fs.readFileSync(path.join(rootDir, ".releaserc.helm.json"), "utf-8");
    const json = JSON.parse(content);
    expect(Array.isArray(json.branches)).toBe(true);
    expect(Array.isArray(json.plugins)).toBe(true);
  });
});
