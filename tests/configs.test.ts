import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Code Configurations Imports", () => {
  it("should import vitest.config.cjs without errors and check basic structure", async () => {
    const vitestConfigPath = path.join(process.cwd(), "configs", "vitest.config.cjs");
    const configModule = require(vitestConfigPath);
    expect(configModule).toBeDefined();
    // vitest.config.cjs exports an object directly, not a default export.
    expect(configModule.test).toBeDefined();
  });

  it("should import tsdown.config.cjs without errors and check basic structure", async () => {
    const tsdownConfigPath = path.join(process.cwd(), "configs", "tsdown.config.cjs");
    const configModule = await import(tsdownConfigPath);
    expect(configModule).toBeDefined();
    expect(configModule.default).toBeDefined();
    expect(configModule.default.entry).toBeDefined();
  });

  it("should import snodeb.config.ts without errors and check basic structure", async () => {
    const snodebConfigPath = path.join(process.cwd(), "configs", "snodeb.config.cjs");
    const configModule = await import(snodebConfigPath);
    expect(configModule).toBeDefined();
    expect(configModule.default).toBeDefined();
    expect(configModule.default.files).toBeDefined();
  });

  it("should import commitlint.config.ts without errors", async () => {
    const commitlintConfigPath = path.join(process.cwd(), "configs", "commitlint.config.cjs");
    const configModule = await import(commitlintConfigPath);
    expect(configModule).toBeDefined();
    expect(configModule.default).toBeDefined();
    expect(configModule.default.extends).toBeDefined();
  });

  // a project's CHANGELOG.md and generated docs belong to release-please and typedoc, not the formatter
  it("should leave Markdown out of biome.json", () => {
    const biome = JSON.parse(fs.readFileSync(path.join(process.cwd(), "configs", "biome.json"), "utf8"));
    // an override, as extends merges files.includes and would widen a project's own
    expect(biome.files).toBeUndefined();
    expect(biome.overrides).toContainEqual({
      includes: ["**/*.md"],
      formatter: { enabled: false },
      linter: { enabled: false },
      assist: { enabled: false },
    });
  });
});

const rootDir = path.join(process.cwd(), "configs");

describe("JSON Configurations", () => {
  it("should validate biome.json", () => {
    const content = fs.readFileSync(path.join(rootDir, "biome.json"), "utf-8");
    const json = JSON.parse(content);
    expect(json).toHaveProperty("$schema");
    expect(json.formatter).toBeDefined();
  });
});
