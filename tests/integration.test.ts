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

// What the generated .index.yml's check pipelines run: the lint stage's Biome and type check, then the
// test and build stages, and the package checks after the build
function runCheckStages(tempDir: string) {
  expect(fs.existsSync(path.join(tempDir, ".github/workflows/.index.yml"))).toBe(true);
  execSync("npx @biomejs/biome ci .", { cwd: tempDir, stdio: "pipe" });
  execSync("npm run type", { cwd: tempDir, stdio: "pipe" });
  execSync("npm test", { cwd: tempDir, stdio: "pipe" });
  execSync("npm run build", { cwd: tempDir, stdio: "pipe" });
  execSync("npm run --if-present publint", { cwd: tempDir, stdio: "pipe" });
  execSync("npm run --if-present docs:check", { cwd: tempDir, stdio: "pipe" });
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
    "backend scaffold passes its CI check stages, and runs",
    () => {
      scaffoldAndInstall(tempDir, "--backend");
      // formats the scaffold, as the pre-commit hook does before its first commit reaches CI
      execSync("npm run lint", { cwd: tempDir, stdio: "pipe" });
      runCheckStages(tempDir);
      const output = execSync("npm start", { cwd: tempDir, encoding: "utf-8" });
      expect(output).toContain("Hello from");
    },
    180000,
  );

  it(
    "backend scaffold resolves the @/ alias in tsc, vitest and the build, and tsc emits into the project",
    () => {
      scaffoldAndInstall(tempDir, "--backend");
      fs.writeFileSync(path.join(tempDir, "src/util.ts"), 'export const greeting = "aliased";\n');
      fs.writeFileSync(
        path.join(tempDir, "src/index.ts"),
        'import { greeting } from "@/util";\n\nconsole.log(`Hello from ${greeting}!`);\n',
      );
      fs.writeFileSync(
        path.join(tempDir, "src/util.test.ts"),
        'import { expect, it } from "vitest";\nimport { greeting } from "@/util";\n\nit("resolves @/", () => {\n  expect(greeting).toBe("aliased");\n});\n',
      );
      execSync("npm run type", { cwd: tempDir, stdio: "pipe" });
      execSync("npm test", { cwd: tempDir, stdio: "pipe" });
      execSync("npm run build", { cwd: tempDir, stdio: "pipe" });
      expect(execSync("npm start", { cwd: tempDir, encoding: "utf-8" })).toContain("Hello from aliased!");

      // a plain tsc emits into the project's dist/, never into the installed forgejs package
      fs.rmSync(path.join(tempDir, "dist"), { recursive: true, force: true });
      execSync("npx tsc", { cwd: tempDir, stdio: "pipe" });
      expect(fs.existsSync(path.join(tempDir, "dist/src/index.js"))).toBe(true);
      expect(fs.existsSync(path.join(tempDir, "node_modules/@apollogeddon/forgejs/configs/dist"))).toBe(false);
    },
    180000,
  );

  it(
    "library scaffold passes its CI check stages, publint included",
    () => {
      scaffoldAndInstall(tempDir, "--library");
      // formats the scaffold, as the pre-commit hook does before its first commit reaches CI
      execSync("npm run lint", { cwd: tempDir, stdio: "pipe" });
      runCheckStages(tempDir);
      execSync("npm run publint", { cwd: tempDir, stdio: "pipe" });
    },
    180000,
  );

  it(
    "website scaffold lints, type-checks, and builds with vite, resolving the @/ alias",
    () => {
      scaffoldAndInstall(tempDir, "--website");
      // the @/ alias resolves in tsc and Vite as it does for a backend
      fs.writeFileSync(path.join(tempDir, "src/greeting.ts"), 'export const greeting = "aliased";\n');
      fs.writeFileSync(path.join(tempDir, "src/main.ts"), 'import { greeting } from "@/greeting";\n\nconsole.log(greeting);\n');
      execSync("npm run lint", { cwd: tempDir, stdio: "pipe" });
      execSync("npm run type", { cwd: tempDir, stdio: "pipe" });
      execSync("npm run build", { cwd: tempDir, stdio: "pipe" });
      // bundled in, not left as an import the browser can't resolve
      const assets = path.join(tempDir, "dist/assets");
      const bundle = fs.readdirSync(assets).map((file) => fs.readFileSync(path.join(assets, file), "utf-8"));
      expect(bundle.join("")).toContain("aliased");
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
