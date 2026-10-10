import { createRequire } from "node:module";
import * as features from "./features/index.js";
import { setDependency } from "./features/types.js";
import type { InitConfig, PackageJson } from "./types.js";
import type { IFileSystem } from "./utils/filesystem.js";
import { NodeFileSystem } from "./utils/filesystem.js";

// core.ts and the tsdown bundle output are both one directory below repo root, so
// "../package.json" resolves in both - don't move this into a deeper-nested file.
const require = createRequire(import.meta.url);
const ownPackageJson = require("../package.json") as { name: string; version: string };

export function init(cfg: InitConfig, fs: IFileSystem = new NodeFileSystem()): number {
  const cwd = fs.cwd();
  let hasError = false;

  console.log(`Initializing Forge.js in ${cwd}...`);
  if (cfg.dryRun) {
    console.log("⚠️  DRY RUN MODE: No files will be created or modified.");
  }
  console.log(
    "Active Features:",
    Object.entries(cfg)
      .filter(([key, val]) => val === true && key !== "force" && key !== "dryRun")
      .map(([key]) => key)
      .join(", "),
  );

  if (cfg.force) {
    console.log("⚠️  Force mode enabled. Existing files will be overwritten.");
  }

  const packageJsonPath = fs.join(cwd, "package.json");
  let packageJson: PackageJson;

  try {
    if (!fs.existsSync(packageJsonPath)) {
      console.log("📝 Creating new package.json");
      packageJson = {
        name: fs.basename(cwd),
        version: "1.0.0",
        description: "",
        main: "index.js",
        scripts: {},
        keywords: [],
        author: "",
        license: "ISC",
      };
    } else {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      // a package.json needn't have a scripts field, but every feature adds to it
      packageJson.scripts ??= {};
    }
  } catch (error) {
    console.error(
      "❌ Failed to parse or read existing package.json:",
      error instanceof Error ? error.message : String(error),
    );
    return 1;
  }

  // Generated scripts (biome, tsdown, vitest, ...) resolve via npm hoisting once
  // forgejs is a devDependency here - without this line, none of them work.
  setDependency(packageJson, cfg, ownPackageJson.name, `^${ownPackageJson.version}`);

  const activeFeatures: features.Feature[] = [
    features.BaseFeature,
    features.LintingFeature,
    features.BuildFeature,
    features.TestingFeature,
    features.VersioningFeature,
    features.DockerFeature,
    features.DebianFeature,
    features.WorkflowFeature,
  ];

  for (const feature of activeFeatures) {
    if (feature.shouldRun(cfg)) {
      if (!feature.apply(cwd, cfg, fs, packageJson)) {
        hasError = true;
      }
    }
  }

  // Features only mutate packageJson in memory; this is the single write.
  try {
    if (cfg.dryRun) {
      console.log("[DryRun] Would update package.json");
    } else {
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
      console.log("✅ Updated package.json");
    }
  } catch (error) {
    console.error("❌ Failed to update package.json:", error instanceof Error ? error.message : String(error));
    hasError = true;
  }

  for (const feature of activeFeatures) {
    feature.cleanup(cwd, cfg, fs);
  }

  if (hasError) {
    console.error("\n❌ Initialization completed with errors.");
    return 1;
  }

  console.log("\nInitialization complete!");
  console.log("Next steps:");
  console.log('1. Run "npm install" to ensure dependencies are linked.');
  // npm install runs the "prepare" script, which installs the git hooks, unless the
  // project already had a prepare script that this run left as it was
  if (cfg.linting && !packageJson.scripts?.prepare?.includes("lefthook install")) {
    console.log('2. Run "npx lefthook install" to set up git hooks.');
  }
  return 0;
}
