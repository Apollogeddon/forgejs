import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import * as yaml from "js-yaml";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { NODE_VERSION } from "../src/versions.js";

const CLI_SCRIPT = path.resolve(__dirname, "../src/index.ts");
// Generated .index.yml calls these pipelines at @main; this repo is what @main serves
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
function runExpectingFailure(args: string, cwd: string, status = 2): string {
  try {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} ${args}`, { cwd, stdio: "pipe" });
  } catch (error) {
    expect((error as { status?: number }).status).toBe(status);
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
      needs?: string | string[];
      with?: Record<string, unknown>;
      secrets?: unknown;
      permissions?: Record<string, string>;
    }
  >;
};

function readGeneratedWorkflow(cwd: string): GeneratedWorkflow {
  return yaml.load(fs.readFileSync(path.join(cwd, ".github/workflows/.index.yml"), "utf-8")) as GeneratedWorkflow;
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
      "tsdown.config.ts",
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
    expect(dockerfile).toContain(`FROM --platform=$BUILDPLATFORM node:${NODE_VERSION}-slim AS build\n`);
    expect(dockerfile).toContain(`FROM node:${NODE_VERSION}-slim AS deps\n`);
    expect(dockerfile).toContain("USER node");
  });

  it("should name a scoped package's image for the package alone", () => {
    fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "@acme/my-service" }));
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --docker`, { cwd: tempDir });

    const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.scripts["docker:build"]).toMatch(/ -t my-service \.$/);
    expect(packageJson.scripts["docker:run"]).toMatch(/ my-service$/);
  });

  it("should name a project in a directory with spaces and capitals validly", () => {
    const dir = path.join(tempDir, "My JS");
    fs.mkdirSync(dir);
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --docker`, { cwd: dir });

    const packageJson = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8"));
    expect(packageJson.name).toBe("my-js");
    expect(packageJson.scripts["docker:build"]).toMatch(/ -t my-js \.$/);
    expect(packageJson.scripts["docker:run"]).toMatch(/ my-js$/);
  });

  it("should give an image a valid name when package.json has an unusual one or none", () => {
    fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ name: "My_Service" }));
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --docker`, { cwd: tempDir });
    let packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.scripts["docker:build"]).toMatch(/ -t my-service \.$/);

    fs.writeFileSync(path.join(tempDir, "package.json"), JSON.stringify({ version: "1.0.0" }));
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --docker --force`, { cwd: tempDir });
    packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.scripts["docker:build"]).not.toContain("undefined");
    expect(packageJson.scripts["docker:build"]).toMatch(/ -t forgejs-test-[0-9-]+ \.$/);
  });

  it("should support --website flag", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --website`, { cwd: tempDir });

    expect(fs.existsSync(path.join(tempDir, "vite.config.ts"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "tsdown.config.ts"))).toBe(false);

    const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.scripts.dev).toBe("vite");
    expect(packageJson.scripts.build).toBe("vite build");
  });

  it("should support --library flag to setup library only", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --library`, { cwd: tempDir });

    expect(fs.existsSync(path.join(tempDir, "tsdown.config.ts"))).toBe(true);

    expect(fs.existsSync(path.join(tempDir, "vitest.config.ts"))).toBe(true);

    expect(readGeneratedWorkflow(tempDir).jobs.library?.uses).toBe(
      "apollogeddon/forgejs/.github/workflows/library.yml@main",
    );
  });

  it("should setup service workflow for backend", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --backend`, { cwd: tempDir });
    expect(readGeneratedWorkflow(tempDir).jobs.service?.uses).toBe(
      "apollogeddon/forgejs/.github/workflows/service.yml@main",
    );
  });

  it("should support --debian flag to setup snodeb", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --debian`, { cwd: tempDir });

    expect(fs.existsSync(path.join(tempDir, "snodeb.config.cjs"))).toBe(true);

    expect(fs.existsSync(path.join(tempDir, "tsdown.config.ts"))).toBe(true);

    const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.scripts["build:deb"]).toBe("snodeb");
    expect(packageJson.scripts.build).toBe("tsdown");
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

    expect(updatedPackageJson.scripts.build).toBe("tsdown");
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

  it.each([
    ["--backend --website", /one mode/],
    ["--website --debian", /debian/i],
    ["--testing --no-testing", /--testing and --no-testing/],
    ["--all --no-all", /--all and --no-all/],
  ])("should exit 2 for the invalid combination %s", (flags, reason) => {
    expect(runExpectingFailure(`init ${flags}`, tempDir)).toMatch(reason);
    expect(fs.existsSync(path.join(tempDir, "package.json"))).toBe(false);
  });

  it.each(["--version", "-V"])("should print the Forge.js version with %s", (flag) => {
    const own = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../package.json"), "utf-8"));
    const stdout = execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} ${flag}`, { cwd: tempDir, encoding: "utf-8" });
    expect(stdout.trim()).toBe(`forgejs ${own.version}`);
    expect(fs.existsSync(path.join(tempDir, "package.json"))).toBe(false);
  });

  it.each(["--version", "-V"])("should print the version for init %s rather than scaffold", (flag) => {
    const stdout = execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init ${flag}`, { cwd: tempDir, encoding: "utf-8" });
    expect(stdout).toMatch(/^forgejs \d/);
    expect(fs.existsSync(path.join(tempDir, "package.json"))).toBe(false);
  });

  it("should reject the removed init --no-version flag", () => {
    expect(runExpectingFailure("init --no-version", tempDir, 1)).toMatch(/no-version/);
    expect(fs.existsSync(path.join(tempDir, "package.json"))).toBe(false);
  });

  it("should pin the version given with --node in .nvmrc, engines and the Dockerfile", () => {
    fs.writeFileSync(path.join(tempDir, ".nvmrc"), "24\n");
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --docker --node 26`, { cwd: tempDir });
    expect(fs.readFileSync(path.join(tempDir, ".nvmrc"), "utf-8")).toBe("26\n");
    const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.engines.node).toBe(">=26");
    expect(fs.readFileSync(path.join(tempDir, "Dockerfile"), "utf-8")).toContain("FROM node:26-slim\n");
  });

  it("should keep the version a project's .nvmrc pins without --node", () => {
    fs.writeFileSync(path.join(tempDir, ".nvmrc"), "v25.1.0\n");
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --docker`, { cwd: tempDir });
    expect(fs.readFileSync(path.join(tempDir, ".nvmrc"), "utf-8")).toBe("v25.1.0\n");
    expect(fs.readFileSync(path.join(tempDir, "Dockerfile"), "utf-8")).toContain("FROM node:25.1.0-slim\n");
  });

  it("should warn that --node didn't reach a Dockerfile it kept", () => {
    fs.writeFileSync(path.join(tempDir, "Dockerfile"), "FROM node:24-slim\n");
    const result = spawnSync("node", [TSX_CLI, CLI_SCRIPT, "init", "--docker", "--node", "26"], {
      cwd: tempDir,
      encoding: "utf-8",
    });
    expect(result.stderr).toContain("Dockerfile kept: set its node base images to 26");
    expect(fs.readFileSync(path.join(tempDir, "Dockerfile"), "utf-8")).toBe("FROM node:24-slim\n");
  });

  it("should leave an .nvmrc it can't read alone and fall back to its default, with a warning", () => {
    fs.writeFileSync(path.join(tempDir, ".nvmrc"), "lts/*\n");
    const result = spawnSync("node", [TSX_CLI, CLI_SCRIPT, "init", "--docker"], { cwd: tempDir, encoding: "utf-8" });
    expect(result.stderr).toContain(`.nvmrc's "lts/*" isn't a Node.js version init can use`);
    expect(fs.readFileSync(path.join(tempDir, ".nvmrc"), "utf-8")).toBe("lts/*\n");
    expect(fs.readFileSync(path.join(tempDir, "Dockerfile"), "utf-8")).toContain(`FROM node:${NODE_VERSION}-slim\n`);
  });

  it.each(["banana", "22", "24.x", "''"])("should exit 2 for --node %s", (version) => {
    expect(runExpectingFailure(`init --node ${version}`, tempDir)).toMatch(/--node takes/);
  });

  it.each(["-C", "--path"])("should scaffold the directory given with %s, creating it", (flag) => {
    const target = path.join(tempDir, "nested", "app");
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init ${flag} "${target}"`, { cwd: tempDir });
    expect(JSON.parse(fs.readFileSync(path.join(target, "package.json"), "utf-8")).name).toBe("app");
    expect(fs.existsSync(path.join(target, "tsconfig.json"))).toBe(true);
    expect(fs.existsSync(path.join(tempDir, "package.json"))).toBe(false);
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
    ["--debian", "service"],
  ])("should add a docker job after the checks for %s --docker", (mode, pipeline) => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init ${mode} --docker`, { cwd: tempDir });
    const docker = readGeneratedWorkflow(tempDir).jobs.docker;
    expect(docker.uses).toBe("apollogeddon/forgejs/.github/workflows/docker.yml@main");
    expect(docker.needs).toEqual(["version", pipeline]);
    expect(docker.permissions?.packages).toBe("write");
    expect(String(docker.with?.version)).toBe("${{ needs.version.outputs.version }}");
  });

  it("should not add a docker job without --docker", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --backend`, { cwd: tempDir });
    expect(Object.keys(readGeneratedWorkflow(tempDir).jobs)).toEqual(["version", "service", "merge"]);
  });

  it("should package a Debian backend after its checks", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --debian`, { cwd: tempDir });
    const jobs = readGeneratedWorkflow(tempDir).jobs;
    expect(jobs.debian?.needs).toBe("service");
    expect(jobs.publish?.with?.assets).toBe("debian-package");
  });

  describe("an index.yml an earlier forgejs generated", () => {
    const old = () => path.join(tempDir, ".github/workflows/index.yml");
    const legacy = fs.readFileSync(path.resolve(__dirname, "fixtures/legacy/library.yml"), "utf-8");
    const write = (content: string) => {
      fs.mkdirSync(path.dirname(old()), { recursive: true });
      fs.writeFileSync(old(), content);
    };
    const init = (args: string) =>
      spawnSync("node", [TSX_CLI, CLI_SCRIPT, "init", ...args.split(" ").filter(Boolean)], {
        cwd: tempDir,
        encoding: "utf-8",
      });

    it("is removed when it's exactly as init wrote it", () => {
      write(legacy);
      const result = init("--library");
      expect(result.status).toBe(0);
      expect(fs.existsSync(old())).toBe(false);
      expect(result.stdout).toContain("Removed obsolete file: .github/workflows/index.yml");
      expect(fs.existsSync(path.join(tempDir, ".github/workflows/.index.yml"))).toBe(true);
    });

    it("is kept, with a warning, once it's been changed", () => {
      const customised = legacy.replace("    with:\n", "    with:\n      runs_on: xerus\n");
      write(customised);
      const result = init("--library");
      expect(result.status).toBe(0);
      expect(fs.readFileSync(old(), "utf-8")).toBe(customised);
      expect(result.stderr).toContain("has been changed since init wrote it");
      expect(result.stdout).toContain("use --force to delete");
    });

    it("is removed with --force once it's been changed", () => {
      write(legacy.replace("    with:\n", "    with:\n      runs_on: xerus\n"));
      expect(init("--library --force").status).toBe(0);
      expect(fs.existsSync(old())).toBe(false);
    });

    it("is kept on a dry run", () => {
      write(legacy);
      expect(init("--library --dry-run").status).toBe(0);
      expect(fs.existsSync(old())).toBe(true);
    });

    // without a new workflow written, removing the old one would leave the project with no CI
    it("is kept when .index.yml was kept", () => {
      write(legacy);
      fs.writeFileSync(path.join(tempDir, ".github/workflows/.index.yml"), "name: own\n");
      const result = init("--library");
      expect(result.status).toBe(0);
      expect(fs.existsSync(old())).toBe(true);
    });

    it("is never removed when it's the project's own", () => {
      const own = "jobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - run: npm test\n";
      write(own);
      const result = init("--force");
      expect(result.status).toBe(0);
      expect(fs.readFileSync(old(), "utf-8")).toBe(own);
      expect(result.stderr).toContain("Left .github/workflows/index.yml");
    });
  });

  it.each([
    ["--no-testing", "run_tests"],
    ["--no-versioning", "version"],
  ])("should switch off the matching pipeline step for %s", (flag, input) => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init ${flag}`, { cwd: tempDir });
    const jobs = readGeneratedWorkflow(tempDir).jobs;
    if (input === "run_tests") expect(jobs.service?.with?.run_tests).toBe(false);
    // without versioning there's no release to wait for, so no version job
    else expect(jobs.version).toBeUndefined();
  });

  it.each([
    "--backend",
    "--library",
    "--website",
    "--debian",
    "--backend --docker --no-testing --no-versioning",
    "--library --no-testing --no-versioning",
    "--website --docker --no-testing --no-versioning",
    "--debian --docker --no-testing --no-versioning",
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
    // a run outside a pull request has a group of its own, so one on main is never cancelled
    expect(workflow.concurrency?.group).toContain("github.head_ref || github.run_id");
    for (const [name, job] of Object.entries(workflow.jobs)) {
      // the called workflows only use GITHUB_TOKEN, which they get without inheriting every secret
      expect(job.secrets, `${name} passes secrets`).toBeUndefined();
      // only GitHub Pages and a library's attestations need an OIDC token
      const attests = name === "publish" && flags === "--library";
      if (name !== "pages" && !attests) expect(job.permissions?.["id-token"], `${name} asks for id-token`).toBeUndefined();
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
      "tsdown.config.ts",
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
    expect(fs.existsSync(path.join(tempDir, "tsdown.config.ts"))).toBe(true);
    // --no-all turns off the standard features, not the default backend mode
    expect(fs.existsSync(path.join(tempDir, ".github", "workflows", ".index.yml"))).toBe(true);
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

  it("should not include the commitlint hook in lefthook.yml when --no-versioning is passed", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --no-versioning`, { cwd: tempDir });
    const lefthookConfig = fs.readFileSync(path.join(tempDir, "lefthook.yml"), "utf-8");
    expect(lefthookConfig).not.toContain("commitlint");
  });

  // .nvmrc is where the Node.js version lives: CI reads it, so the generated .index.yml sets none
  it("should pin the project's Node.js version in .nvmrc and engines", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init`, { cwd: tempDir });

    expect(fs.readFileSync(path.join(tempDir, ".nvmrc"), "utf-8")).toBe(`${NODE_VERSION}\n`);
    const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, "package.json"), "utf-8"));
    expect(packageJson.engines.node).toBe(`>=${NODE_VERSION}`);
    expect(fs.readFileSync(path.join(tempDir, ".github/workflows/.index.yml"), "utf-8")).not.toContain("node_version");
  });

  it("should keep a project's own engines.node without --force", () => {
    const packageJsonPath = path.join(tempDir, "package.json");
    fs.writeFileSync(packageJsonPath, JSON.stringify({ name: "legacy", engines: { node: ">=20" } }));
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init`, { cwd: tempDir });

    expect(JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")).engines.node).toBe(">=20");
  });

  it("should write .editorconfig and a Dependabot config with a cooldown", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init`, { cwd: tempDir });

    expect(fs.readFileSync(path.join(tempDir, ".editorconfig"), "utf-8")).toContain("root = true");

    const dependabot = yaml.load(fs.readFileSync(path.join(tempDir, ".github/dependabot.yml"), "utf-8")) as {
      updates: { "package-ecosystem": string; cooldown: { "default-days": number } }[];
    };
    expect(dependabot.updates.map((u) => u["package-ecosystem"])).toEqual(["npm", "github-actions"]);
    for (const update of dependabot.updates) {
      expect(update.cooldown["default-days"]).toBe(3);
    }
  });

  it("should add Docker to the Dependabot config with --docker", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init --docker`, { cwd: tempDir });
    const dependabot = yaml.load(fs.readFileSync(path.join(tempDir, ".github/dependabot.yml"), "utf-8")) as {
      updates: { "package-ecosystem": string }[];
    };
    expect(dependabot.updates.map((u) => u["package-ecosystem"])).toContain("docker");
  });

  it("should name the GitHub remote's owner in CODEOWNERS, and skip it without one", () => {
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init`, { cwd: tempDir });
    expect(fs.existsSync(path.join(tempDir, ".github/CODEOWNERS"))).toBe(false);

    execSync("git init -q", { cwd: tempDir });
    execSync("git remote add origin git@github.com:acme/widget.git", { cwd: tempDir });
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init`, { cwd: tempDir });
    expect(fs.readFileSync(path.join(tempDir, ".github/CODEOWNERS"), "utf-8")).toContain("* @acme");
  });

  it("should prefer package.json's repository for the CODEOWNERS owner", () => {
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ name: "widget", repository: { type: "git", url: "git+https://github.com/octo-org/widget.git" } }),
    );
    execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init`, { cwd: tempDir });
    expect(fs.readFileSync(path.join(tempDir, ".github/CODEOWNERS"), "utf-8")).toContain("* @octo-org");
  });
}, 120000);
