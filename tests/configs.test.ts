import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";


async function importModule(modulePath: string) {
  if (modulePath.endsWith(".cjs")) {
    return require(modulePath);
  } else {
    return await import(modulePath);
  }
}

describe("Code Configurations Imports", () => {
  it("should import vitest.config.cjs without errors and check basic structure", async () => {
    const vitestConfigPath = path.join(process.cwd(), "configs", "vitest.config.cjs");
    const configModule = await importModule(vitestConfigPath);
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
    // named after this repository's package, as it reads the package.json where snodeb runs
    expect(configModule.default.systemd).toMatchObject({ user: "forgejs", group: "forgejs" });
  });

  it("should import commitlint.config.ts without errors", async () => {
    const commitlintConfigPath = path.join(process.cwd(), "configs", "commitlint.config.cjs");
    const configModule = await import(commitlintConfigPath);
    expect(configModule).toBeDefined();
    expect(configModule.default).toBeDefined();
    expect(configModule.default.extends).toBeDefined();
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
