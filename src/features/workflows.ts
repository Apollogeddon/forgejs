import * as templates from "../templates/index.js";
import type { InitConfig, PackageJson } from "../types.js";
import type { IFileSystem } from "../utils/filesystem.js";
import { createFile, type Feature } from "./types.js";

export const INDEX_WORKFLOW = ".github/workflows/.index.yml";
const OLD_INDEX_WORKFLOW = ".github/workflows/index.yml";

// Before .index.yml, forgejs generated index.yml; left in place it would run every pipeline twice. A
// project's own index.yml, one calling nothing of forgejs's, stays, with a warning.
export function removeOldIndexWorkflow(cwd: string, cfg: InitConfig, fs: IFileSystem): void {
  const file = fs.join(cwd, OLD_INDEX_WORKFLOW);
  if (!fs.existsSync(file)) return;
  if (!templates.isForgeIndexWorkflow(fs.readFileSync(file, "utf-8"))) {
    console.warn(
      `⚠️  Left ${OLD_INDEX_WORKFLOW}, which doesn't call forgejs's pipelines: check it doesn't repeat ${INDEX_WORKFLOW}'s jobs.`,
    );
    return;
  }
  if (cfg.dryRun) {
    console.log(`[DryRun] Would remove ${OLD_INDEX_WORKFLOW}, which ${INDEX_WORKFLOW} replaces`);
    return;
  }
  try {
    fs.unlinkSync(file);
    console.log(`🗑️  Removed ${OLD_INDEX_WORKFLOW}, which ${INDEX_WORKFLOW} replaces`);
  } catch (error) {
    console.warn(
      `⚠️  Failed to remove ${OLD_INDEX_WORKFLOW}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const GITHUB_OWNER = /github\.com[:/]([A-Za-z0-9][A-Za-z0-9-]*)\//;

// The GitHub account the project lives under, from package.json's repository or the git
// remote, so CODEOWNERS can name it. Undefined until the project has a GitHub remote.
export function githubOwner(cwd: string, fs: IFileSystem, packageJson: PackageJson): string | undefined {
  const repository = packageJson.repository;
  const url = typeof repository === "string" ? repository : (repository as { url?: string } | undefined)?.url;
  const fromPackage = url?.match(GITHUB_OWNER)?.[1];
  if (fromPackage) return fromPackage;

  const gitConfig = fs.join(cwd, ".git", "config");
  if (!fs.existsSync(gitConfig)) return undefined;
  const origin = fs
    .readFileSync(gitConfig, "utf-8")
    .split(/^\[/m)
    .find((section) => section.startsWith('remote "origin"'));
  return origin?.match(GITHUB_OWNER)?.[1];
}

export const WorkflowFeature: Feature = {
  name: "GitHub Workflows",
  shouldRun: () => true,
  apply: (cwd, cfg, fs, packageJson) => {
    let ok = createFile(cwd, ".github/dependabot.yml", templates.dependabotConfig(cfg.docker), cfg, fs);

    const owner = githubOwner(cwd, fs, packageJson);
    if (owner) {
      ok = createFile(cwd, ".github/CODEOWNERS", templates.codeowners(owner), cfg, fs) && ok;
    } else {
      console.log("ℹ️  No GitHub remote yet, so no .github/CODEOWNERS. Run init again once the project has one.");
    }

    const mode = cfg.library ? "library" : cfg.website ? "website" : "service";
    const workflow = templates.indexWorkflow({
      mode,
      debian: cfg.debian,
      docker: cfg.docker,
      testing: cfg.testing,
      versioning: cfg.versioning,
    });
    ok = createFile(cwd, INDEX_WORKFLOW, workflow, cfg, fs) && ok;
    removeOldIndexWorkflow(cwd, cfg, fs);
    return ok;
  },
  cleanup: () => {},
};
