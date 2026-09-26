import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Real end-to-end checks: scaffold a project, install real dependencies (pointing
// the devDependency at this repo via `file:`), and run the real generated scripts.
// Unlike the rest of the suite (which only checks generated file content), this is
// the only place that catches wiring bugs like a config extending a path that never
// gets installed, or a build script that has no source to build.

const CLI_SCRIPT = path.resolve(__dirname, "../src/index.ts");
const REPO_ROOT = path.resolve(__dirname, "..").replace(/\\/g, "/");

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

function scaffoldAndInstall(tempDir: string, ...initArgs: string[]) {
  execSync(`npx tsx ${CLI_SCRIPT} init ${initArgs.join(" ")}`, { cwd: tempDir, stdio: "pipe" });

  const pkgPath = path.join(tempDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  pkg.devDependencies["@apollogeddon/forgejs"] = `file:${REPO_ROOT}`;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));

  execSync("git init -q", { cwd: tempDir, stdio: "pipe" });
  execSync("npm install --legacy-peer-deps --install-links", { cwd: tempDir, stdio: "pipe" });
}

describe("End-to-end: a scaffolded project actually works", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `forgejs-e2e-${Date.now()}-${Math.floor(Math.random() * 1000)}`);
    if (fs.existsSync(tempDir)) robustRemoveDir(tempDir);
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    robustRemoveDir(tempDir);
  });

  it(
    "backend scaffold lints, type-checks, builds, tests, and runs",
    () => {
      scaffoldAndInstall(tempDir, "--backend");
      execSync("npm run lint", { cwd: tempDir, stdio: "pipe" });
      execSync("npm run type", { cwd: tempDir, stdio: "pipe" });
      execSync("npm run build", { cwd: tempDir, stdio: "pipe" });
      execSync("npm test", { cwd: tempDir, stdio: "pipe" });
      const output = execSync("npm start", { cwd: tempDir, encoding: "utf-8" });
      expect(output).toContain("Hello from");
    },
    180000,
  );

  it(
    "library scaffold lints, type-checks, builds, tests, and passes publint",
    () => {
      scaffoldAndInstall(tempDir, "--library");
      execSync("npm run lint", { cwd: tempDir, stdio: "pipe" });
      execSync("npm run type", { cwd: tempDir, stdio: "pipe" });
      execSync("npm run build", { cwd: tempDir, stdio: "pipe" });
      execSync("npm test", { cwd: tempDir, stdio: "pipe" });
      execSync("npm run publint", { cwd: tempDir, stdio: "pipe" });
    },
    180000,
  );

  it(
    "website scaffold lints, type-checks, and builds with vite",
    () => {
      scaffoldAndInstall(tempDir, "--website");
      execSync("npm run lint", { cwd: tempDir, stdio: "pipe" });
      execSync("npm run type", { cwd: tempDir, stdio: "pipe" });
      execSync("npm run build", { cwd: tempDir, stdio: "pipe" });
      execSync("npm test", { cwd: tempDir, stdio: "pipe" });
    },
    180000,
  );
}, 900000);
