#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

import * as templates from "@/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PACKAGE_ROOT = path.resolve(__dirname, "..");

// Define available options
const options = {
  debian: { type: "boolean" },
  library: { type: "boolean" },
  version: { type: "boolean" },
  testing: { type: "boolean" },
  force: { type: "boolean" },
  all: { type: "boolean" },
} as const;

// Parse arguments
const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options,
  strict: false, // Allow other commands like 'init'
});

const command = positionals[0];

// Determine active features
// If no specific feature flags are set, and 'all' is not explicitly false, default to standard stack (library + testing + version)
const specificFlags = ["debian", "library", "version", "testing"];
const hasSpecificFlag = specificFlags.some((flag) => values[flag as keyof typeof values]);
const isDefault = !hasSpecificFlag && values.all !== false;

const config = {
  force: !!values.force,
  debian: !!values.debian,
  library: !!(values.library ?? (isDefault || values.all)),
  testing: !!(values.testing ?? (isDefault || values.all)),
  version: !!(values.version ?? (isDefault || values.all)),
};

if (command === "init") {
  init(config);
} else {
  console.log(`
Usage: npx @apollogeddon/forgejs init [options]

Options:
  --debian    Setup Debian packaging (snodeb)
  --library   Setup Library tooling (tsup, astro, docs) [Default]
  --version   Setup Versioning (semantic-release, commitlint) [Default]
  --testing   Setup Testing (vitest) [Default]
  --all       Enable all standard features (Library, Version, Testing)
  --force     Overwrite existing files
`);
  process.exit(1);
}

export function init(cfg: typeof config) {
  const cwd = process.cwd();
  console.log(`Initializing CI templates in ${cwd}...`);
  console.log(
    "Active Features:",
    Object.entries(cfg)
      .filter(([key, val]) => val === true && key !== "force")
      .map(([key]) => key)
      .join(", "),
  );

  if (cfg.force) {
    console.log("⚠️  Force mode enabled. Existing files will be overwritten.");
  }

  // 1. Base Setup (Always run)
  setupBase(cwd, cfg.force);

  // 2. Linting (Always run as part of base standard)
  setupLinting(cwd, cfg.force);

  // 3. Build (Always run)
  setupBuild(cwd, cfg.force);

  // 4. Testing
  if (cfg.testing) {
    setupTesting(cwd, cfg.force);
  }

  // 5. Versioning
  if (cfg.version) {
    setupVersioning(cwd, cfg.force);
  }

  // 6. Library
  if (cfg.library) {
    setupLibrary(cwd, cfg.force);
  }

  // 7. Debian
  if (cfg.debian) {
    setupDebian(cwd, cfg.force);
  }

  // 8. Workflows
  setupWorkflows(cwd, cfg);

  // 9. Package.json Scripts
  updatePackageJson(cwd, cfg);

  console.log("\nInitialization complete!");
  console.log("Next steps:");
  console.log('1. Run "npm install" to ensure dependencies are linked.');
  console.log('2. Run "npx lefthook install" to set up git hooks.');
}

function createFile(cwd: string, fileName: string, content: string, force: boolean) {
  const filePath = path.join(cwd, fileName);
  const dirPath = path.dirname(filePath);

  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  if (fs.existsSync(filePath) && !force) {
    console.log(`⚠️  ${fileName} already exists. Skipping.`);
  } else {
    const exists = fs.existsSync(filePath);
    fs.writeFileSync(filePath, content);
    console.log(`✅ ${exists ? "Overwrote" : "Created"} ${fileName}`);
  }
}

function setupBase(cwd: string, force: boolean) {
  createFile(cwd, "tsconfig.json", templates.tsconfigConfig, force);
}

function setupLinting(cwd: string, force: boolean) {
  createFile(cwd, "biome.json", templates.biomeConfig, force);

  // Lefthook
  try {
    const lefthookSource = path.join(PACKAGE_ROOT, "lefthook.yml");
    if (fs.existsSync(lefthookSource)) {
      createFile(cwd, "lefthook.yml", fs.readFileSync(lefthookSource, "utf-8"), force);
    }
  } catch (_error) {
    console.warn("Warning: Could not read source lefthook.yml from package.");
  }
}

function setupBuild(cwd: string, force: boolean) {
  createFile(cwd, "tsup.config.ts", templates.tsupConfig, force);
}

function setupTesting(cwd: string, force: boolean) {
  createFile(cwd, "vitest.config.ts", templates.vitestConfig, force);
}

function setupVersioning(cwd: string, force: boolean) {
  createFile(cwd, ".releaserc.json", templates.releaseConfig, force);
  createFile(cwd, "commitlint.config.ts", templates.commitlintConfig, force);
}

function setupLibrary(cwd: string, force: boolean) {
  createFile(cwd, "astro.config.mjs", templates.astroConfig, force);
  createFile(cwd, "src/content/docs/index.mdx", templates.starlightContentIndex, force);
}

function setupDebian(cwd: string, force: boolean) {
  createFile(cwd, "snodeb.config.cjs", templates.snodebConfig, force);
}

function setupWorkflows(cwd: string, cfg: typeof config) {
  // If Debian is requested, it takes precedence for the primary CI file if we only want one.
  // Or we can write specific ones. Let's write specific ones to avoid overriding user intent.
  // Actually, standard is usually just one 'ci.yml'.

  let workflowContent = "";
  let workflowName = "";

  if (cfg.debian) {
    workflowContent = templates.debianWorkflow;
    workflowName = ".github/workflows/ci.yml";
    // If both library and debian are requested, debian is likely the deployment target,
    // while library is just the build method.
  } else if (cfg.library) {
    workflowContent = templates.libraryWorkflow;
    workflowName = ".github/workflows/ci.yml";
  }

  if (workflowContent && workflowName) {
    createFile(cwd, workflowName, workflowContent, cfg.force);
  }
}

interface PackageJson {
  name: string;
  version: string;
  description: string;
  main?: string;
  type?: string;
  scripts: Record<string, string>;
  keywords: string[];
  author: string;
  license: string;
  [key: string]: unknown;
}

function updatePackageJson(cwd: string, cfg: typeof config) {
  const packageJsonPath = path.join(cwd, "package.json");
  let packageJson: PackageJson;

  if (!fs.existsSync(packageJsonPath)) {
    console.log("📝 Creating new package.json");
    packageJson = {
      name: path.basename(cwd),
      version: "1.0.0",
      description: "",
      main: "index.js",
      scripts: {},
      keywords: [],
      author: "",
      license: "ISC",
    };
  } else {
    try {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    } catch (error) {
      console.error("❌ Failed to parse existing package.json:", error);
      return;
    }
  }

  try {
    if (packageJson.type !== "module") {
      packageJson.type = "module";
      console.log("✅ Set 'type': 'module' in package.json");
    }

    const scripts: Record<string, string> = {
      watch: "tsx watch src/index.ts",
      start: "tsx src/index.ts",
      lint: "biome check --fix",
      type: "tsc --noEmit",
      build: "tsup",
      prepare: "lefthook install",
    };

    if (cfg.library) {
      scripts["docs:init"] = "astro sync";
      scripts["docs:build"] = "astro build";
      scripts["docs:watch"] = "astro dev";
      scripts.publint = "publint";
    }

    if (cfg.testing) {
      scripts.test = "vitest run";
    }

    // Debian doesn't usually need a specific script in package.json other than potentially 'build:deb'
    // but the workflow handles it via npx snodeb. We can add a helper though.
    if (cfg.debian) {
      scripts["build:deb"] = "snodeb";
    }

    packageJson.scripts = {
      ...scripts,
      ...packageJson.scripts, // Keep existing scripts if they exist? Or overwrite?
      // Previous logic was overwriting but preserving `...packageJson.scripts` at the END
      // which means existing scripts took precedence if they had the same key?
      // Wait, `...recommendedScripts, ...packageJson.scripts` means existing scripts override recommended ones.
      // Let's stick to that to be safe.
    };

    // Ensure our recommended scripts override if they are crucial?
    // Actually, usually you want to inject YOUR scripts.
    // Let's use `...packageJson.scripts, ...scripts` to enforce our scripts,
    // OR `...scripts, ...packageJson.scripts` to respect user overrides.
    // The previous code was: `packageJson.scripts = { ...recommendedScripts, ...packageJson.scripts };`
    // So user scripts (loaded from file) overrode the generated ones. I will keep that behavior.

    packageJson.scripts = {
      ...scripts,
      ...packageJson.scripts,
    };

    console.log("✅ Updated scripts in package.json");
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.error("❌ Failed to update package.json:", error);
  }
}
