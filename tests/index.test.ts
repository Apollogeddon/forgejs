import { execSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import * as yaml from "js-yaml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const CLI_SCRIPT = path.resolve(__dirname, "../src/index.ts");
// Generated index.yml calls these reusable workflows at @main; this repo is what @main serves
const REPO_WORKFLOWS = path.resolve(__dirname, "../.github/workflows");

// Invoking the local tsx binary directly, rather than `npx tsx` from an unrelated tempDir cwd,
// avoids npx re-resolving/installing tsx per call - a source of npm cache races under CI parallelism.
const require = createRequire(import.meta.url);
const tsxPackageJsonPath = require.resolve("tsx/package.json");
const TSX_CLI = path.join(path.dirname(tsxPackageJsonPath), require(tsxPackageJsonPath).bin);

// Retries because Windows can briefly hold locks on just-used files
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
        const syncWait = (ms: number) => {
          const end = Date.now() + ms;
          while (Date.now() < end) {}
        };
        syncWait(delay);
      }
    }
  }
}

// Returns stderr so tests can check the rejection reason, not just that something threw.
function runExpectingFailure(args: string, cwd: string): string {
  try {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} ${args}`, { cwd, stdio: "pipe" });
  } catch (error) {
    return String((error as { stderr?: Buffer }).stderr ?? "");
  }
  throw new Error(`Expected "${args}" to fail`);
}

const DEFAULT_SCRIPTS = ["watch", "start", "lint", "security", "type", "build", "test", "prepare"];

type GeneratedWorkflow = {
  concurrency?: { group?: string; "cancel-in-progress"?: string };
  jobs: Record<
    string,
    {
      uses?: string;
      needs?: string;
      with?: Record<string, unknown>;
      secrets?: unknown;
      permissions?: Record<string, string>;
    }
  >;
};

function readGeneratedWorkflow(cwd: string): GeneratedWorkflow {
  return yaml.load(fs.readFileSync(path.join(cwd, ".github/workflows/index.yml"), "utf-8")) as GeneratedWorkflow;
}

describe("CLI Init Command", () => {
  let tempDir: string;

  beforeEach(() => {
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
    try {
      execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init`, { cwd: tempDir });
    } catch (error) {
      throw new Error(`CLI execution failed: ${error}`);
    }

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
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init`, { cwd: tempDir });

    const biomeConfig = JSON.parse(fs.readFileSync(path.join(tempDir, "biome.json"), "utf-8"));
    expect(biomeConfig.extends).toContain("node_modules/@apollogeddon/forgejs/configs/biome.json");
  });

  it("should not overwrite existing files without --force", () => {
    const dummyContent = '{"dummy": true, "original": true}';
    fs.writeFileSync(path.join(tempDir, "biome.json"), dummyContent);

    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init`, { cwd: tempDir });

    const content = fs.readFileSync(path.join(tempDir, "biome.json"), "utf-8");
    expect(content).toBe(dummyContent);
  });

  it("should overwrite existing files with --force", () => {
    const dummyContent = '{"dummy": true, "original": true}';
    fs.writeFileSync(path.join(tempDir, "biome.json"), dummyContent);

    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --force`, { cwd: tempDir });

    const content = fs.readFileSync(path.join(tempDir, "biome.json"), "utf-8");
    expect(content).not.toBe(dummyContent);
    expect(content).toContain("node_modules/@apollogeddon/forgejs/configs/biome.json");
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

    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init`, { cwd: tempDir });

    const updatedPackageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));

    expect(updatedPackageJson.type).toBe("module");
    expect(updatedPackageJson.scripts.custom).toBe("echo hello");
    expect(Object.keys(updatedPackageJson.scripts)).toEqual(expect.arrayContaining(DEFAULT_SCRIPTS));
  });

  it("should create package.json if it does not exist and add type: module and scripts", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init`, { cwd: tempDir });

    const packageJsonPath = path.join(tempDir, "package.json");
    expect(fs.existsSync(packageJsonPath)).toBe(true);

    const updatedPackageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

    expect(updatedPackageJson.type).toBe("module");
    expect(Object.keys(updatedPackageJson.scripts)).toEqual(expect.arrayContaining(DEFAULT_SCRIPTS));
  });

  it("should support --docker flag", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --docker`, { cwd: tempDir });

    expect(fs.existsSync(path.join(tempDir, "Dockerfile"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, ".dockerignore"))).toBe(true);

    const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.scripts["docker:build"]).toBeDefined();
    expect(packageJson.scripts["docker:run"]).toBeDefined();

    const dockerfile = fs.readFileSync(path.join(tempDir, "Dockerfile"), "utf-8");
    // compiled once on the build host, but production deps installed per target platform
    expect(dockerfile).toMatch(/^FROM --platform=\$BUILDPLATFORM node:22-slim AS build$/m);
    expect(dockerfile).toMatch(/^FROM node:22-slim AS deps$/m);
    expect(dockerfile).toContain("USER node");
  });

  it("should support --website flag", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --website`, { cwd: tempDir });

    expect(fs.existsSync(path.join(tempDir, "vite.config.ts"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "tsup.config.ts"))).toBe(false);

    const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.scripts.dev).toBe("vite");
    expect(packageJson.scripts.build).toBe("vite build");
  });

  it("should support --library flag to setup library only", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --library`, { cwd: tempDir });

    expect(fs.existsSync(path.join(tempDir, "tsup.config.ts"))).toBe(true);

    expect(fs.existsSync(path.join(tempDir, "vitest.config.ts"))).toBe(true);

    const workflowPath = path.join(tempDir, ".github/workflows/index.yml");
    expect(fs.existsSync(workflowPath)).toBe(true);
    const workflowContent = fs.readFileSync(workflowPath, "utf-8");
    expect(workflowContent).toContain("library.yml");
  });

  it("should setup service workflow for backend", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --backend`, { cwd: tempDir });
    const workflowPath = path.join(tempDir, ".github/workflows/index.yml");
    expect(fs.existsSync(workflowPath)).toBe(true);
    const workflowContent = fs.readFileSync(workflowPath, "utf-8");
    expect(workflowContent).toContain("service.yml");
  });

  it("should support --debian flag to setup snodeb", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --debian`, { cwd: tempDir });

    expect(fs.existsSync(path.join(tempDir, "snodeb.config.cjs"))).toBe(true);

    expect(fs.existsSync(path.join(tempDir, "tsup.config.ts"))).toBe(true);

    const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.scripts["build:deb"]).toBe("snodeb");
    expect(packageJson.scripts.build).toBe("tsup");
  });

  it("should not create files or modify package.json with --dry-run", () => {
    const initialPackageJson = { name: "test", scripts: { test: "echo original" } };
    fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify(initialPackageJson));

    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --dry-run`, { cwd: tempDir });

    expect(fs.existsSync(path.join(tempDir, "biome.json"))).toBe(false);

    const currentPackageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(currentPackageJson.scripts.test).toBe("echo original");
  });

  it("should overwrite user scripts when running with --force", () => {
    const initialPackageJson = {
      name: "test",
      scripts: {
        build: "echo old-build", // Conflict
        custom: "echo custom", // Non-conflict
      },
    };
    fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify(initialPackageJson));

    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --force`, { cwd: tempDir });

    const updatedPackageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));

    expect(updatedPackageJson.scripts.build).toBe("tsup");
    expect(updatedPackageJson.scripts.custom).toBe("echo custom");
  });

  it("should display help with --help", () => {
    const stdout = execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} --help`, { cwd: tempDir, encoding: "utf-8" });
    expect(stdout).toContain("Usage:");
    expect(stdout).toContain("--dry-run");
  });

  it("should fail when using --library with --docker", () => {
    expect(runExpectingFailure("init --library --docker", tempDir)).toMatch(/docker/i);
  });

  it("should fail when using --library with --debian", () => {
    expect(runExpectingFailure("init --library --debian", tempDir)).toMatch(/debian/i);
  });

  it("should generate Nginx Dockerfile for --website --docker", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --website --docker`, { cwd: tempDir });
    expect(fs.existsSync(path.join(tempDir, "Dockerfile"))).toBe(true);
    const content = fs.readFileSync(path.join(tempDir, "Dockerfile"), "utf-8");
    expect(content).toContain("nginx");
    expect(content).toContain("npm ci");
  });

  it.each([
    ["--backend", "service"],
    ["--website", "website"],
    ["--debian", "debian"],
  ])("should add a docker job after the pipeline for %s --docker", (mode, pipeline) => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init ${mode} --docker`, { cwd: tempDir });
    const docker = readGeneratedWorkflow(tempDir).jobs.docker;
    expect(docker.uses).toContain("/docker.yml@");
    expect(docker.needs).toBe(pipeline);
    expect(docker.permissions?.packages).toBe("write");
    expect(String(docker.with?.version)).toContain(`needs.${pipeline}.outputs.version`);
  });

  it("should not add a docker job without --docker", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --backend`, { cwd: tempDir });
    expect(Object.keys(readGeneratedWorkflow(tempDir).jobs)).toEqual(["service"]);
  });

  it.each([
    ["--no-testing", "run_tests"],
    ["--no-version", "enable_versioning"],
  ])("should switch off the matching pipeline step for %s", (flag, input) => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init ${flag}`, { cwd: tempDir });
    expect(readGeneratedWorkflow(tempDir).jobs.service.with?.[input]).toBe(false);
  });

  it.each([
    "--backend",
    "--library",
    "--website",
    "--debian",
    "--backend --docker --no-testing --no-version",
    "--library --no-testing --no-version",
    "--website --docker --no-testing --no-version",
    "--debian --docker --no-testing --no-version",
  ])("should only pass inputs the called workflows declare (%s)", (flags) => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init ${flags}`, { cwd: tempDir });
    for (const [name, job] of Object.entries(readGeneratedWorkflow(tempDir).jobs)) {
      const callee = path.basename(String(job.uses).split("@")[0]);
      const workflow = yaml.load(fs.readFileSync(path.join(REPO_WORKFLOWS, callee), "utf-8")) as {
        on: { workflow_call: { inputs?: Record<string, unknown> } };
      };
      const declared = Object.keys(workflow.on.workflow_call.inputs ?? {});
      for (const input of Object.keys(job.with ?? {})) {
        expect(declared, `${name} passes undeclared input '${input}' to ${callee}`).toContain(input);
      }
    }
  });

  it.each([
    "--backend",
    "--library",
    "--website",
    "--debian",
    "--backend --docker",
  ])("should generate a least-privilege workflow that never cancels main (%s)", (flags) => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init ${flags}`, { cwd: tempDir });
    const workflow = readGeneratedWorkflow(tempDir);
    expect(workflow.concurrency?.["cancel-in-progress"]).toContain("refs/heads/main");
    for (const [name, job] of Object.entries(workflow.jobs)) {
      // the called workflows only use GITHUB_TOKEN, which they get without inheriting every secret
      expect(job.secrets, `${name} passes secrets`).toBeUndefined();
      // only GitHub Pages needs an OIDC token
      if (name !== "website") expect(job.permissions?.["id-token"], `${name} asks for id-token`).toBeUndefined();
    }
  });

  it("should fail when using --website with --debian", () => {
    expect(runExpectingFailure("init --website --debian", tempDir)).toMatch(/debian/i);
  });

  it("should set private: true for backend/website projects", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --backend`, { cwd: tempDir });
    const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.private).toBe(true);
  });

  it("should cleanup obsolete files when changing modes", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --debian`, { cwd: tempDir });
    expect(fs.existsSync(path.join(tempDir, "snodeb.config.cjs"))).toBe(true);

    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --backend`, { cwd: tempDir });
    expect(fs.existsSync(path.join(tempDir, "snodeb.config.cjs"))).toBe(true);

    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --backend --force`, { cwd: tempDir });
    expect(fs.existsSync(path.join(tempDir, "snodeb.config.cjs"))).toBe(false);
  });

  it("should NOT set private: true for library projects", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --library`, { cwd: tempDir });
    const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.private).toBeUndefined();
  });

  it("should fail when using --backend with --website", () => {
    expect(runExpectingFailure("init --backend --website", tempDir)).toMatch(/mode/i);
  });

  it("should fail when using --backend with --library", () => {
    expect(runExpectingFailure("init --backend --library", tempDir)).toMatch(/mode/i);
  });

  it("should behave as default backend when --all is passed with no mode flag", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --all`, { cwd: tempDir });
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
      execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} frobnicate`, { cwd: tempDir, stdio: "pipe" });
    }).toThrow();
  });

  it("should exit non-zero when no command is given", () => {
    expect(() => {
      execSync(`node "${TSX_CLI}" ${CLI_SCRIPT}`, { cwd: tempDir, stdio: "pipe" });
    }).toThrow();
  });

  it("should exit non-zero when package.json is malformed", () => {
    fs.writeFileSync(path.join(tempDir, "package.json"), "{ this is : not valid json ");
    expect(() => {
      execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init`, { cwd: tempDir, stdio: "pipe" });
    }).toThrow();
  });

  it("should actually disable a feature with --no-<feature>", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --no-testing`, { cwd: tempDir });
    expect(fs.existsSync(path.join(tempDir, "vitest.config.ts"))).toBe(false);
    // unaffected standard features still run
    expect(fs.existsSync(path.join(tempDir, "biome.json"))).toBe(true);
  });

  it("should disable all standard features with --no-all", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --no-all`, { cwd: tempDir });
    expect(fs.existsSync(path.join(tempDir, "vitest.config.ts"))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, "biome.json"))).toBe(false);
    expect(fs.existsSync(path.join(tempDir, "commitlint.config.ts"))).toBe(false);
    // Build/Base features always run regardless of --no-all
    expect(fs.existsSync(path.join(tempDir, "tsup.config.ts"))).toBe(true);
    // --no-all turns off the standard features, not the default backend mode
    expect(fs.existsSync(path.join(tempDir, ".github", "workflows", "index.yml"))).toBe(true);
  });

  it("should only tell the user to install the git hooks when npm install won't", () => {
    const fresh = execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init`, { cwd: tempDir, encoding: "utf-8" });
    expect(fresh).not.toMatch(/lefthook install/);

    const other = fs.mkdtempSync(path.join(os.tmpdir(), "forgejs-prepare-"));
    try {
      fs.writeFileSync(path.join(other, "package.json"), JSON.stringify({ name: "x", scripts: { prepare: "husky" } }));
      const kept = execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init`, { cwd: other, encoding: "utf-8" });
      expect(kept).toMatch(/npx lefthook install/);
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  it("should let an explicit flag re-enable a feature disabled by --no-all", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --no-all --testing`, { cwd: tempDir });
    expect(fs.existsSync(path.join(tempDir, "vitest.config.ts"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "biome.json"))).toBe(false);
  });

  it("should exit non-zero for an unknown flag instead of silently ignoring it", () => {
    expect(() => {
      execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --dockr`, { cwd: tempDir, stdio: "pipe" });
    }).toThrow();
  });

  it("should show help before validating conflicting flags", () => {
    const stdout = execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --library --docker --help`, {
      cwd: tempDir,
      encoding: "utf-8",
    });
    expect(stdout).toContain("Usage:");
  });

  it("should not overwrite a pre-existing custom script without --force", () => {
    const initialPackageJson = { name: "test", scripts: { lint: "echo custom-lint" } };
    fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify(initialPackageJson));

    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init`, { cwd: tempDir });

    const updatedPackageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(updatedPackageJson.scripts.lint).toBe("echo custom-lint");
  });

  it("should add scripts to an existing package.json that has no scripts field", () => {
    fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "test", version: "0.0.0" }));

    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init`, { cwd: tempDir });

    const updatedPackageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(updatedPackageJson.scripts.lint).toBeDefined();
  });

  it("should not include the commitlint hook in lefthook.yml when --no-version is passed", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --no-version`, { cwd: tempDir });
    const lefthookConfig = fs.readFileSync(path.join(tempDir, "lefthook.yml"), "utf-8");
    expect(lefthookConfig).not.toContain("commitlint");
  });
}, 120000);
