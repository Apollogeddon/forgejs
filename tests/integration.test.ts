import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// The only suite that installs real deps and runs the generated scripts, so it catches wiring
// bugs (a config extending an uninstalled path, a build with no source) that content checks miss.

const CLI_SCRIPT = path.resolve(__dirname, "../src/index.ts");
const REPO_ROOT = path.resolve(__dirname, "..").replace(/\\/g, "/");

const require = createRequire(import.meta.url);
const tsxPackageJsonPath = require.resolve("tsx/package.json");
const TSX_CLI = path.join(path.dirname(tsxPackageJsonPath), require(tsxPackageJsonPath).bin);

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
  execSync(`node "${TSX_CLI}" ${CLI_SCRIPT} init ${initArgs.join(" ")}`, { cwd: tempDir, stdio: "pipe" });

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

  afterEach(
    () => {
      robustRemoveDir(tempDir);
    },
    30000, // removing a full node_modules can exceed vitest's 10s default on Windows
  );

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

const hasDocker = spawnSync("docker", ["info"], { stdio: "ignore" }).status === 0;

// The Dockerfile's `npm ci` runs inside the build context, where the file: path scaffoldAndInstall
// points at doesn't exist, so vendor this repo into the context as a tarball instead.
function vendorForgejsIntoContext(tempDir: string) {
  const packed = execSync(`npm pack "${REPO_ROOT}" --pack-destination . --silent`, { cwd: tempDir, encoding: "utf-8" });
  const tarball = packed.trim().split("\n").pop();
  const pkgPath = path.join(tempDir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  pkg.devDependencies["@apollogeddon/forgejs"] = `file:./${tarball}`;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  execSync("npm install --legacy-peer-deps", { cwd: tempDir, stdio: "pipe" });
}

describe.skipIf(!hasDocker)("End-to-end: a scaffolded project's Docker image builds and runs", () => {
  let tempDir: string;
  let image: string;

  beforeEach(() => {
    const id = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    tempDir = path.join(os.tmpdir(), `forgejs-docker-${id}`);
    image = `forgejs-e2e:${id}`;
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    spawnSync("docker", ["rmi", "-f", image], { stdio: "ignore" });
    robustRemoveDir(tempDir);
  }, 30000);

  it(
    "backend image builds and runs",
    () => {
      scaffoldAndInstall(tempDir, "--backend", "--docker");
      vendorForgejsIntoContext(tempDir);
      execSync(`docker build -t ${image} .`, { cwd: tempDir, stdio: "pipe" });
      const output = execSync(`docker run --rm ${image}`, { cwd: tempDir, encoding: "utf-8" });
      expect(output).toContain("Hello from");
    },
    300000,
  );

  it(
    "website image builds",
    () => {
      scaffoldAndInstall(tempDir, "--website", "--docker");
      vendorForgejsIntoContext(tempDir);
      execSync(`docker build -t ${image} .`, { cwd: tempDir, stdio: "pipe" });
    },
    300000,
  );
}, 900000);
