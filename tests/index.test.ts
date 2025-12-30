import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI_SCRIPT = path.resolve(__dirname, "../src/index.ts");

describe("CLI Init Command", () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a unique temporary directory for each test
    tempDir = path.join(__dirname, `tmp-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
    if (fs.existsSync(tempDir)) {
      // Should not happen with unique names, but just in case
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (e) {
        console.warn(e);
      }
    }
    fs.mkdirSync(tempDir);
  });

  afterEach(async () => {
    // Clean up
    if (fs.existsSync(tempDir)) {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (error) {
        // Ignore EBUSY errors on Windows which can happen if the process hasn't fully released locks
        console.warn(`Warning: Failed to clean up temp dir: ${error}`);
      }
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
      "astro.config.mjs",
      "tsconfig.json",
      "src/content/docs/index.mdx",
      "commitlint.config.ts",
      "tsup.config.ts",
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
        watch: "tsx watch src/index.ts",
        lint: "biome check --fix",
        type: "tsc --noEmit",
        build: "tsup",
        "docs:init": "astro sync",
        "docs:build": "astro build",
        "docs:watch": "astro dev",
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
        watch: "tsx watch src/index.ts",
        start: "tsx src/index.ts",
        lint: "biome check --fix",
        type: "tsc --noEmit",
        build: "tsup",
        "docs:init": "astro sync",
        "docs:build": "astro build",
        "docs:watch": "astro dev",
        test: "vitest run",
        publint: "publint",
        prepare: "lefthook install",
      }),
    );
  });

  it("should support --debian flag to setup snodeb", () => {
    execSync(`npx tsx ${CLI_SCRIPT} init --debian`, { cwd: tempDir });

    // Should create snodeb config
    expect(fs.existsSync(path.join(tempDir, "snodeb.config.cjs"))).toBe(true);

    // Should create tsup config (now default)
    expect(fs.existsSync(path.join(tempDir, "tsup.config.ts"))).toBe(true);

    // Should NOT create library-specific files (astro/docs)
    expect(fs.existsSync(path.join(tempDir, "astro.config.mjs"))).toBe(false);

    // Should update package.json with debian script AND build script
    const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.scripts["build:deb"]).toBe("snodeb");
    expect(packageJson.scripts.build).toBe("tsup");
  });

  it("should support --library flag to setup library only", () => {
    execSync(`npx tsx ${CLI_SCRIPT} init --library`, { cwd: tempDir });

    // Should create library files
    expect(fs.existsSync(path.join(tempDir, "astro.config.mjs"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "tsup.config.ts"))).toBe(true);

    // Should NOT create snodeb config
    expect(fs.existsSync(path.join(tempDir, "snodeb.config.cjs"))).toBe(false);

    // Should NOT create testing config if not requested
    expect(fs.existsSync(path.join(tempDir, "vitest.config.ts"))).toBe(false);

    // Should setup library workflow
    const workflowContent = fs.readFileSync(path.join(tempDir, ".github/workflows/ci.yml"), "utf-8");
    expect(workflowContent).toContain("library.yml");
  });

  it("should not create files or modify package.json with --dry-run", () => {
    // Create a dummy package.json to verify it's not modified
    const initialPackageJson = { name: "test", scripts: { test: "echo original" } };
    fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify(initialPackageJson));

    const stdout = execSync(`npx tsx ${CLI_SCRIPT} init --dry-run`, { cwd: tempDir, encoding: "utf-8" });

    // Should log dry run warnings
    expect(stdout).toContain("DRY RUN MODE");
    expect(stdout).toContain("[DryRun] Would");

    // Files should NOT be created
    expect(fs.existsSync(path.join(tempDir, "biome.json"))).toBe(false);

    // package.json should NOT be modified
    const currentPackageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(currentPackageJson.scripts.test).toBe("echo original");
  });

  it("should overwrite user scripts when running with --force", () => {
    // Create package.json with conflicting script
    const initialPackageJson = {
      name: "test",
      scripts: {
        build: "echo old-build", // Conflict
        custom: "echo custom", // Non-conflict
      },
    };
    fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify(initialPackageJson));

    execSync(`npx tsx ${CLI_SCRIPT} init --force`, { cwd: tempDir });

    const updatedPackageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));

    // Conflicting script should be overwritten
    expect(updatedPackageJson.scripts.build).toBe("tsup");

    // Non-conflicting script should be preserved (because ...packageJson.scripts is merged in)
    // Wait, let's check my logic in src/index.ts:
    // packageJson.scripts = { ...packageJson.scripts, ...scripts };
    // This merges OLD then NEW. So NEW wins.
    // But OLD non-conflicting keys are still there.
    expect(updatedPackageJson.scripts.custom).toBe("echo custom");
  });

  it("should display help with --help", () => {
    const stdout = execSync(`npx tsx ${CLI_SCRIPT} --help`, { cwd: tempDir, encoding: "utf-8" });
    expect(stdout).toContain("Usage: npx @apollogeddon/forgejs init");
    expect(stdout).toContain("--dry-run");
  });
});
