import * as templates from "../templates/index.js";
import type { PackageJson } from "../types.js";
import type { IFileSystem } from "../utils/filesystem.js";
import { createFile, type Feature } from "./types.js";

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

    let workflowContent = "";
    let workflowName = "";

    if (cfg.debian) {
      workflowContent = templates.debianWorkflow;
      workflowName = ".github/workflows/index.yml";
    } else if (cfg.library) {
      workflowContent = templates.libraryWorkflow;
      workflowName = ".github/workflows/index.yml";
    } else if (cfg.website) {
      workflowContent = templates.websiteWorkflow;
      workflowName = ".github/workflows/index.yml";
    } else if (cfg.backend) {
      workflowContent = templates.serviceWorkflow;
      workflowName = ".github/workflows/index.yml";
    }

    if (workflowContent && workflowName) {
      const inputs: Record<string, boolean> = {};
      if (!cfg.testing) inputs.run_tests = false;
      if (!cfg.version) inputs.enable_versioning = false;
      workflowContent = templates.withPipelineInputs(workflowContent, inputs);
      if (cfg.docker) {
        workflowContent = templates.withDocker(workflowContent);
      }
      ok = createFile(cwd, workflowName, workflowContent, cfg, fs) && ok;
    }
    return ok;
  },
  cleanup: () => {},
};
