import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI_SCRIPT = path.resolve(__dirname, "../src/index.ts");

describe("CLI Init Command", () => {
  const tempDir = path.join(__dirname, "temp-test-env");

  beforeEach(() => {
    // Create a temporary directory for testing
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir);
  });

  afterEach(() => {
    // Clean up
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("should create configuration files when running init", () => {
    // We use tsx to run the typescript file directly
    try {
      execSync(`npx tsx ${CLI_SCRIPT} init`, { cwd: tempDir });
    } catch (error) {
      // If the process exits with 1, it might be due to our mock environment or missing args,
      // but here we expect success (exit code 0).
      throw new Error(`CLI execution failed: ${error}`);
    }

    // Check if files were created
    const expectedFiles = [
      "biome.json",
      "vitest.config.ts",
      ".releaserc.json",
      "typedoc.json",
      "commitlint.config.ts",
      "tsdown.config.ts",
      "lefthook.yml",
    ];

    for (const file of expectedFiles) {
      expect(fs.existsSync(path.join(tempDir, file))).toBe(true);
    }
  });

  it("should verify content of generated biome.json", () => {
    execSync(`npx tsx ${CLI_SCRIPT} init`, { cwd: tempDir });

    const biomeConfig = JSON.parse(fs.readFileSync(path.join(tempDir, "biome.json"), "utf-8"));
    expect(biomeConfig.extends).toContain("node_modules/@apollogeddon/forgejs/biome.json");
  });

  it("should not overwrite existing files without --force", () => {
    // Create a dummy file first
    const dummyContent = '{"dummy": true, "original": true}';
    fs.writeFileSync(path.join(tempDir, "biome.json"), dummyContent);

    execSync(`npx tsx ${CLI_SCRIPT} init`, { cwd: tempDir });

    // Check content remains unchanged
    const content = fs.readFileSync(path.join(tempDir, "biome.json"), "utf-8");
    expect(content).toBe(dummyContent);
  });

  it("should overwrite existing files with --force", () => {
    // Create a dummy file first
    const dummyContent = '{"dummy": true, "original": true}';
    fs.writeFileSync(path.join(tempDir, "biome.json"), dummyContent);

    execSync(`npx tsx ${CLI_SCRIPT} init --force`, { cwd: tempDir });

    // Check content has been overwritten
    const content = fs.readFileSync(path.join(tempDir, "biome.json"), "utf-8");
    // Expect content to be the default biome config now
    expect(content).not.toBe(dummyContent);
    expect(content).toContain("node_modules/@apollogeddon/forgejs/biome.json");
  });

  it("should update package.json with type: module and recommended scripts", () => {
    const initialPackageJson = {
      name: "test-project",
      version: "1.0.0",
      scripts: {
        start: "node index.js",
      },
    };
    fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify(initialPackageJson, null, 2));

    execSync(`npx tsx ${CLI_SCRIPT} init`, { cwd: tempDir });

    const updatedPackageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));

    expect(updatedPackageJson.type).toBe("module");
    expect(updatedPackageJson.scripts).toEqual(
      expect.objectContaining({
        start: "node index.js", // Existing script should be preserved
        lint: "biome check --fix",
        type: "tsc --noEmit",
        build: "tsdown",
        doc: "typedoc",
        test: "vitest run",
        publint: "publint",
        prepare: "lefthook install",
      }),
    );
  });

  it("should create package.json if it does not exist and add type: module and scripts", () => {
    // No package.json initially
    execSync(`npx tsx ${CLI_SCRIPT} init`, { cwd: tempDir });

    const packageJsonPath = path.join(tempDir, "package.json");
    expect(fs.existsSync(packageJsonPath)).toBe(true);

    const updatedPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    expect(updatedPackageJson.type).toBe("module");
    expect(updatedPackageJson.scripts).toEqual(
      expect.objectContaining({
        lint: "biome check --fix",
        type: "tsc --noEmit",
        build: "tsdown",
        doc: "typedoc",
        test: "vitest run",
        publint: "publint",
        prepare: "lefthook install",
      }),
    );
  });
});
