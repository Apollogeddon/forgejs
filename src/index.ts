#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import * as templates from "@/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the root of the package.
// We assume this script is running from <package_root>/dist/index.js
// So we go up one level to reach <package_root>
const PACKAGE_ROOT = path.resolve(__dirname, "..");

const args = process.argv.slice(2);
const command = args[0];
const force = args.includes("--force");

if (command === "init") {
  init(force);
} else {
  // If no command or unknown, show help
  console.log("Usage: npx @apollogeddon/forgejs init [--force]");
  process.exit(1);
}

export function init(force = false) {
  const cwd = process.cwd();
  console.log(`Initializing CI templates in ${cwd}...`);
  if (force) {
    console.log("⚠️  Force mode enabled. Existing files will be overwritten.");
  }

  const files = [
    { name: "biome.json", content: templates.biomeConfig },
    { name: "vitest.config.ts", content: templates.vitestConfig },
    { name: ".releaserc.json", content: templates.releaseConfig },
    { name: "typedoc.json", content: templates.typedocConfig },
    { name: "commitlint.config.ts", content: templates.commitlintConfig },
    { name: "tsup.config.ts", content: templates.tsupConfig },
  ];

  // Lefthook: Copy content from package
  try {
    // We look for lefthook.yml in the package root
    const lefthookSource = path.join(PACKAGE_ROOT, "lefthook.yml");
    if (fs.existsSync(lefthookSource)) {
      files.push({
        name: "lefthook.yml",
        content: fs.readFileSync(lefthookSource, "utf-8"),
      });
    } else {
      console.warn(`Warning: Could not find source lefthook.yml at ${lefthookSource}`);
    }
  } catch (_error) {
    console.warn("Warning: Could not read source lefthook.yml from package.");
  }

  for (const file of files) {
    const filePath = path.join(cwd, file.name);
    if (fs.existsSync(filePath) && !force) {
      console.log(`⚠️  ${file.name} already exists. Skipping.`);
    } else {
      const exists = fs.existsSync(filePath);
      fs.writeFileSync(filePath, file.content);
      console.log(`✅ ${exists ? "Overwrote" : "Created"} ${file.name}`);
    }
  }

  updatePackageJson(cwd);

  console.log("\nInitialization complete!");
  console.log("Next steps:");
  console.log('1. Run "npm install" to ensure dependencies are linked.');
  console.log('2. Run "npx lefthook install" to set up git hooks.');
}

interface PackageJson {
  name: string;
  version: string;
  description: string;
  main: string;
  type?: "module" | "commonjs";
  scripts: Record<string, string>;
  keywords: string[];
  author: string;
  license: string;
}

function updatePackageJson(cwd: string) {
  const packageJsonPath = path.join(cwd, "package.json");
  let packageJson: PackageJson;

  if (!fs.existsSync(packageJsonPath)) {
    console.log("📝 Creating new package.json");
    packageJson = {
      name: path.basename(cwd), // Default name to current directory
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
      console.error("❌ Failed to parse existing package.json. Skipping scripts injection:", error);
      return;
    }
  }

  try {
    // Ensure type: module
    if (packageJson.type !== "module") {
      packageJson.type = "module";
      console.log("✅ Set 'type': 'module' in package.json");
    }

    // Add scripts
    const recommendedScripts = {
      lint: "biome check --fix",
      type: "tsc --noEmit",
      build: "tsup",
      doc: "typedoc",
      test: "vitest run",
      publint: "publint",
      prepare: "lefthook install",
    };

    packageJson.scripts = {
      ...packageJson.scripts,
      ...recommendedScripts,
    };

    console.log("✅ Added recommended scripts to package.json");

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.error("❌ Failed to update package.json:", error);
  }
}
