import * as templates from "../templates/index.js";
import type { InitConfig, PackageJson } from "../types.js";
import type { IFileSystem } from "../utils/filesystem.js";
import { createFile, type Feature, removeFile } from "./types.js";

export const INDEX_WORKFLOW = ".github/workflows/.index.yml";

// Before .index.yml, forgejs generated index.yml (and, before 2.3.2, ci.yml and debian.yml); left in place, one
// runs every pipeline twice. One exactly as an earlier forgejs wrote it goes; one calling forgejs's pipelines
// that's been changed goes only with --force, as removeFile does; one calling none of them is the project's own.
export function removeOldWorkflows(cwd: string, cfg: InitConfig, fs: IFileSystem): void {
  for (const file of Object.keys(templates.LEGACY_WORKFLOWS)) {
    const path = fs.join(cwd, file);
    if (!fs.existsSync(path)) continue;
    const content = fs.readFileSync(path, "utf-8");
    if (templates.isLegacyWorkflow(file, content)) {
      removeFile(cwd, file, { ...cfg, force: true }, fs);
    } else if (templates.callsForgejs(content)) {
      if (!cfg.force)
        console.warn(`⚠️  ${file} calls forgejs's old pipelines and has been changed since init wrote it.`);
      removeFile(cwd, file, cfg, fs);
    } else if (file.endsWith("/index.yml")) {
      console.warn(
        `⚠️  Left ${file}, which doesn't call forgejs's pipelines: check it doesn't repeat ${INDEX_WORKFLOW}'s jobs.`,
      );
    }
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
      windows: cfg.windows,
      macos: cfg.macos,
      testing: cfg.testing,
      versioning: cfg.versioning,
    });
    // only once .index.yml is written: a kept or failed one would leave the project with no CI, or the old one
    const replacing = !fs.existsSync(fs.join(cwd, INDEX_WORKFLOW)) || cfg.force;
    const written = createFile(cwd, INDEX_WORKFLOW, workflow, cfg, fs);
    if (written && replacing) removeOldWorkflows(cwd, cfg, fs);
    ok = written && ok;
    return ok;
  },
  cleanup: () => {},
};
