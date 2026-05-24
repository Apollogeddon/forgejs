import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI_SCRIPT = path.resolve(__dirname, "../src/index.ts");

// Helper for robust cleanup on Windows
function robustRemoveDir(dir: string, maxRetries = 5, delay = 500) {
  if (!fs.existsSync(dir)) return;

  for (let i = 0; i < maxRetries; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (i === maxRetries - 1) {
        console.warn(`Warning: Final attempt to clean up temp dir failed: ${error}`);
      } else {
        // Wait and retry
        const syncWait = (ms: number) => {
          const end = Date.now() + ms;
          while (Date.now() < end) {}
        };
        syncWait(delay);
      }
    }
  }
}

describe("CLI Init Command", () => {
  let tempDir: string;

  beforeEach(() => {
    // Create a unique temporary directory for each test in the system temp folder
    tempDir = path.join(os.tmpdir(), `forgejs-test-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
    if (fs.existsSync(tempDir)) {
      robustRemoveDir(tempDir);
    }
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(async () => {
    robustRemoveDir(tempDir);
  });

  it("should create configuration files when running init (default backend)", () => {
    // We use tsx to run the typescript file directly
    try {
      execSync(`npx tsx ${CLI_SCRIPT} init`, { cwd: tempDir });
    } catch (error) {
      throw new Error(`CLI execution failed: ${error}`);
    }

    // Check if files were created
    const expectedFiles = [
      "biome.json",
      "vitest.config.ts",
      "tsconfig.json",
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

  it("should update package.json with type: module and recommended backend scripts", () => {
    const initialPackageJson = {
      name: "test-project",
      version: "1.0.0",
      scripts: {
        custom: "echo hello",
      },
    };
    fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify(initialPackageJson, null, 2));

    execSync(`npx tsx ${CLI_SCRIPT} init`, { cwd: tempDir });

    const updatedPackageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));

    expect(updatedPackageJson.type).toBe("module");
    expect(updatedPackageJson.scripts).toEqual(
      expect.objectContaining({
        custom: "echo hello", // Existing script should be preserved
        watch: "tsx watch src/index.ts",
        start: "node dist/index.js",
        lint: "biome check --fix",
        security: "osv-scanner scan -r .",
        type: "tsc --noEmit",
        build: "tsup",
        test: "vitest run",
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
        start: "node dist/index.js",
        lint: "biome check --fix",
        security: "osv-scanner scan -r .",
        type: "tsc --noEmit",
        build: "tsup",
        test: "vitest run",
        prepare: "lefthook install",
      }),
    );
  });

  it("should support --docker flag", () => {
    execSync(`npx tsx ${CLI_SCRIPT} init --docker`, { cwd: tempDir });

    expect(fs.existsSync(path.join(tempDir, "Dockerfile"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, ".dockerignore"))).toBe(true);

    const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.scripts["docker:build"]).toBeDefined();
    expect(packageJson.scripts["docker:run"]).toBeDefined();
  });

  it("should support --website flag", () => {
    execSync(`npx tsx ${CLI_SCRIPT} init --website`, { cwd: tempDir });

    expect(fs.existsSync(path.join(tempDir, "vite.config.ts"))).toBe(true);
    // Should NOT have tsup config
    expect(fs.existsSync(path.join(tempDir, "tsup.config.ts"))).toBe(false);

    const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.scripts.dev).toBe("vite");
    expect(packageJson.scripts.build).toBe("vite build");
  });

  it("should support --library flag to setup library only", () => {
    execSync(`npx tsx ${CLI_SCRIPT} init --library`, { cwd: tempDir });

    expect(fs.existsSync(path.join(tempDir, "tsup.config.ts"))).toBe(true);

    // Should create testing config (enabled by default)
    expect(fs.existsSync(path.join(tempDir, "vitest.config.ts"))).toBe(true);

    // Should setup library workflow
    const workflowPath = path.join(tempDir, ".github/workflows/ci.yml");
    expect(fs.existsSync(workflowPath)).toBe(true);
    const workflowContent = fs.readFileSync(workflowPath, "utf-8");
    expect(workflowContent).toContain("library.yml");
  });

  it("should setup service workflow for backend", () => {
    execSync(`npx tsx ${CLI_SCRIPT} init --backend`, { cwd: tempDir });
    const workflowPath = path.join(tempDir, ".github/workflows/ci.yml");
    expect(fs.existsSync(workflowPath)).toBe(true);
    const workflowContent = fs.readFileSync(workflowPath, "utf-8");
    expect(workflowContent).toContain("service.yml");
  });

  it("should support --debian flag to setup snodeb", () => {
    execSync(`npx tsx ${CLI_SCRIPT} init --debian`, { cwd: tempDir });

    // Should create snodeb config
    expect(fs.existsSync(path.join(tempDir, "snodeb.config.cjs"))).toBe(true);

    // Should create tsup config (now default)
    expect(fs.existsSync(path.join(tempDir, "tsup.config.ts"))).toBe(true);

    // Should update package.json with debian script AND build script
    const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.scripts["build:deb"]).toBe("snodeb");
    expect(packageJson.scripts.build).toBe("tsup");
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
    expect(updatedPackageJson.scripts.custom).toBe("echo custom");
  });

  it("should display help with --help", () => {
    const stdout = execSync(`npx tsx ${CLI_SCRIPT} --help`, { cwd: tempDir, encoding: "utf-8" });
    expect(stdout).toContain("Usage: npx @apollogeddon/forgejs init");
    expect(stdout).toContain("--dry-run");
  });

  it("should fail when using --library with --docker", () => {
    expect(() => {
      execSync(`npx tsx ${CLI_SCRIPT} init --library --docker`, { cwd: tempDir, stdio: "pipe" });
    }).toThrow();
  });

  it("should fail when using --library with --debian", () => {
    expect(() => {
      execSync(`npx tsx ${CLI_SCRIPT} init --library --debian`, { cwd: tempDir, stdio: "pipe" });
    }).toThrow();
  });

  it("should generate Nginx Dockerfile for --website --docker", () => {
    execSync(`npx tsx ${CLI_SCRIPT} init --website --docker`, { cwd: tempDir });
    expect(fs.existsSync(path.join(tempDir, "Dockerfile"))).toBe(true);
    const content = fs.readFileSync(path.join(tempDir, "Dockerfile"), "utf-8");
    expect(content).toContain("nginx");
    expect(content).toContain("npm ci");
    expect(content).not.toContain("pnpm");
  });

  it("should generate Distroless Dockerfile for --backend --docker", () => {
    execSync(`npx tsx ${CLI_SCRIPT} init --backend --docker`, { cwd: tempDir });
    expect(fs.existsSync(path.join(tempDir, "Dockerfile"))).toBe(true);
    const content = fs.readFileSync(path.join(tempDir, "Dockerfile"), "utf-8");
    expect(content).toContain("gcr.io/distroless/nodejs");
    expect(content).toContain("npm ci");
    expect(content).not.toContain("pnpm");
  });

  it("should fail when using --website with --debian", () => {
    expect(() => {
      execSync(`npx tsx ${CLI_SCRIPT} init --website --debian`, { cwd: tempDir, stdio: "pipe" });
    }).toThrow();
  });

  it("should set private: true for backend/website projects", () => {
    execSync(`npx tsx ${CLI_SCRIPT} init --backend`, { cwd: tempDir });
    const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.private).toBe(true);
  });

  it("should cleanup obsolete files when changing modes", () => {
    // 1. Init as Debian
    execSync(`npx tsx ${CLI_SCRIPT} init --debian`, { cwd: tempDir });
    expect(fs.existsSync(path.join(tempDir, "snodeb.config.cjs"))).toBe(true);

    // 2. Re-init as Backend WITHOUT force (should keep snodeb)
    execSync(`npx tsx ${CLI_SCRIPT} init --backend`, { cwd: tempDir });
    expect(fs.existsSync(path.join(tempDir, "snodeb.config.cjs"))).toBe(true);

    // 3. Re-init as Backend WITH force (should remove snodeb)
    execSync(`npx tsx ${CLI_SCRIPT} init --backend --force`, { cwd: tempDir });
    expect(fs.existsSync(path.join(tempDir, "snodeb.config.cjs"))).toBe(false);
  });

  it("should NOT set private: true for library projects", () => {
    execSync(`npx tsx ${CLI_SCRIPT} init --library`, { cwd: tempDir });
    const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.private).toBeUndefined();
  });

  it("should fail when using --backend with --website", () => {
    expect(() => {
      execSync(`npx tsx ${CLI_SCRIPT} init --backend --website`, { cwd: tempDir, stdio: "pipe" });
    }).toThrow();
  });

  it("should fail when using --backend with --library", () => {
    expect(() => {
      execSync(`npx tsx ${CLI_SCRIPT} init --backend --library`, { cwd: tempDir, stdio: "pipe" });
    }).toThrow();
  });

  it("should behave as default backend when --all is passed with no mode flag", () => {
    execSync(`npx tsx ${CLI_SCRIPT} init --all`, { cwd: tempDir });
    for (const file of [
      "biome.json",
      "vitest.config.ts",
      "tsconfig.json",
      "commitlint.config.ts",
      "tsup.config.ts",
      "lefthook.yml",
    ]) {
      expect(fs.existsSync(path.join(tempDir, file))).toBe(true);
    }
  });

  it("should exit non-zero for an unknown command", () => {
    expect(() => {
      execSync(`npx tsx ${CLI_SCRIPT} frobnicate`, { cwd: tempDir, stdio: "pipe" });
    }).toThrow();
  });

  it("should exit non-zero when no command is given", () => {
    expect(() => {
      execSync(`npx tsx ${CLI_SCRIPT}`, { cwd: tempDir, stdio: "pipe" });
    }).toThrow();
  });

  it("should exit non-zero when package.json is malformed", () => {
    fs.writeFileSync(path.join(tempDir, "package.json"), "{ this is : not valid json ");
    expect(() => {
      execSync(`npx tsx ${CLI_SCRIPT} init`, { cwd: tempDir, stdio: "pipe" });
    }).toThrow();
  });
}, 120000);
