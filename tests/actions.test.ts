import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import { NODE_VERSION } from "../src/versions.js";

const workflowsDir = path.join(process.cwd(), ".github", "workflows");

describe("GitHub Actions Workflows YAML Syntax", () => {
  const workflowFiles = fs.readdirSync(workflowsDir).filter((file) => file.endsWith(".yml"));

  it("should find workflow files to test", () => {
    expect(workflowFiles.length).toBeGreaterThan(0);
  });

  workflowFiles.forEach((file) => {
    it(`should validate YAML syntax for ${file}`, () => {
      const filePath = path.join(workflowsDir, file);
      const fileContent = fs.readFileSync(filePath, "utf-8");

      expect(() => {
        yaml.load(fileContent);
      }).not.toThrow();
    });
  });
});

interface Workflow {
  on?: { workflow_call?: { inputs?: Record<string, unknown>; outputs?: Record<string, unknown> } };
  jobs: Record<
    string,
    {
      if?: string;
      uses?: string;
      with?: Record<string, unknown>;
      secrets?: string;
      steps?: Array<{
        name?: string;
        if?: string;
        uses?: string;
      }>;
    }
  >;
}

describe("GitHub Actions Job Conditions", () => {
  const getWorkflow = (filename: string) => {
    const content = fs.readFileSync(path.join(workflowsDir, filename), "utf-8");
    return yaml.load(content) as unknown as Workflow;
  };

  it("should ensure debian.yml only builds on new_release_published", () => {
    const wf = getWorkflow("debian.yml");
    expect(wf.jobs.build.if).toContain("new_release_published");
  });

  it("should ensure library.yml jobs only run on new_release_published", () => {
    const wf = getWorkflow("library.yml");
    expect(wf.jobs.publish.if).toContain("new_release_published");
  });

  it("should ensure website.yml jobs only run on new_release_published", () => {
    const wf = getWorkflow("website.yml");
    expect(wf.jobs.deploy.if).toContain("new_release_published");
  });
});

describe("Reusable workflow wiring", () => {
  const load = (file: string) =>
    yaml.load(fs.readFileSync(path.join(workflowsDir, file), "utf-8")) as unknown as Workflow;
  const workflowFiles = fs.readdirSync(workflowsDir).filter((file) => file.endsWith(".yml"));

  workflowFiles.forEach((file) => {
    it(`should only call existing local workflows with declared inputs from ${file}`, () => {
      for (const [name, job] of Object.entries(load(file).jobs ?? {})) {
        if (!job.uses?.startsWith("./.github/workflows/")) continue;
        const callee = path.basename(job.uses);
        expect(fs.existsSync(path.join(workflowsDir, callee)), `${file}:${name} calls missing ${callee}`).toBe(true);
        const declared = Object.keys(load(callee).on?.workflow_call?.inputs ?? {});
        for (const input of Object.keys(job.with ?? {})) {
          expect(declared, `${file}:${name} passes undeclared input '${input}' to ${callee}`).toContain(input);
        }
      }
    });
  });
});

describe("Pipeline outputs used by the generated docker job", () => {
  const load = (file: string) =>
    yaml.load(fs.readFileSync(path.join(workflowsDir, file), "utf-8")) as unknown as Workflow;

  it.each(["service.yml", "website.yml", "debian.yml"])("should expose release outputs from %s", (file) => {
    const outputs = Object.keys(load(file).on?.workflow_call?.outputs ?? {});
    expect(outputs).toEqual(expect.arrayContaining(["new_release_published", "version"]));
  });
});

describe("version.yml working_directory", () => {
  const content = fs.readFileSync(path.join(workflowsDir, "version.yml"), "utf-8");
  const wf = yaml.load(content) as unknown as Workflow & {
    jobs: Record<string, { outputs?: Record<string, string>; steps?: Array<{ uses?: string; with?: Record<string, string> }> }>;
  };
  const job = wf.jobs["release-please"];

  it("should pass a sub-directory to release-please as the package path", () => {
    const release = job.steps?.find((step) => step.uses?.startsWith("googleapis/release-please-action"));
    expect(release?.with?.path).toContain("inputs.working_directory");
  });

  // release-please prefixes a sub-directory package's outputs with its path
  it.each(["release_created", "version", "tag_name"])("should read the package's own %s output", (key) => {
    expect(job.outputs?.[key]).toContain(`format('{0}--${key}', inputs.working_directory)`);
  });

  describe("release-please config", () => {
    const release = () => job.steps?.find((step) => step.uses?.startsWith("googleapis/release-please-action"));
    const find = () => job.steps?.find((step) => (step as { id?: string }).id === "config") as
      | { run?: string; env?: Record<string, string> }
      | undefined;

    // runs the step in a scratch checkout holding the given files, and returns what it outputs
    const runFind = (dir: string, files: string[]) => {
      const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "forgejs-version-"));
      const output = path.join(cwd, "output");
      try {
        for (const file of files) {
          fs.mkdirSync(path.dirname(path.join(cwd, file)), { recursive: true });
          fs.writeFileSync(path.join(cwd, file), "{}");
        }
        execFileSync("bash", ["-e", "-c", String(find()?.run)], {
          cwd,
          env: { ...process.env, DIR: dir, GITHUB_OUTPUT: output },
        });
        return fs.existsSync(output) ? fs.readFileSync(output, "utf-8") : "";
      } finally {
        fs.rmSync(cwd, { recursive: true, force: true });
      }
    };

    // release-please fetches the files through the GitHub API, which rejects a leading ./
    it.each([
      [".", ".github"],
      ["./", ".github"],
      ["app", "app/.github"],
      ["./app", "app/.github"],
    ])("should pass release-please the config for working_directory %s as %s", (dir, github) => {
      expect(runFind(dir, [`${github}/release.json`])).toBe(
        `file=${github}/release.json\nmanifest=${github}/.release.json\n`,
      );
    });

    it("should pass no config when the project has none", () => {
      expect(runFind(".", [])).toBe("");
    });

    it("should check out only the project's .github to find it", () => {
      const checkout = job.steps?.find((step) => step.uses?.startsWith("actions/checkout")) as
        | { with?: Record<string, unknown> }
        | undefined;
      expect(checkout?.with?.["sparse-checkout"]).toBe("${{ inputs.working_directory }}/.github");
      expect(checkout?.with?.["persist-credentials"]).toBe(false);
    });

    it("should release a Node.js package only when there is no config", () => {
      expect(release()?.with?.["release-type"]).toBe("${{ steps.config.outputs.file == '' && 'node' || '' }}");
      expect(release()?.with?.["config-file"]).toBe("${{ steps.config.outputs.file }}");
      expect(release()?.with?.["manifest-file"]).toBe("${{ steps.config.outputs.manifest }}");
      expect(release()?.with?.path).toContain("steps.config.outputs.file == ''");
    });
  });

  // releases_created is true when any package is released, so it only counts for the root package
  it("should not report another package's release as this one's", () => {
    const published = String(wf.on?.workflow_call?.outputs?.new_release_published?.value);
    expect(published).toContain("inputs.working_directory == '.' && (jobs.release-please.outputs.releases_created");
    expect(published.match(/releases_created/g)).toHaveLength(2);
  });
});

describe("Review requests on bots' pull requests", () => {
  const load = (file: string) =>
    yaml.load(fs.readFileSync(path.join(workflowsDir, file), "utf-8")) as unknown as Workflow & {
      jobs: Record<string, { needs?: string[] }>;
    };

  // CODEOWNERS requests nothing in a private repository on a free plan, so each pipeline asks itself
  for (const file of ["library.yml", "service.yml", "website.yml", "debian.yml"]) {
    it(`should request a review on Dependabot's pull requests in ${file}, before the checks`, () => {
      const review = load(file).jobs.review;
      expect(review?.uses).toBe("./.github/workflows/review.yml");
      expect(review?.if).toContain("github.event.pull_request.user.login == 'dependabot[bot]'");
      expect(review?.needs).toBeUndefined();
      expect(review?.with?.reviewers).toBe("${{ inputs.reviewers }}");
      expect(load(file).jobs.version?.with?.reviewers).toBe("${{ inputs.reviewers }}");
    });
  }

  it("should request a review on the release pull request release-please opened", () => {
    const review = load("version.yml").jobs.review;
    expect(review?.needs).toEqual(["release-please"]);
    expect(review?.with?.pull_request).toBe("${{ needs.release-please.outputs.pr_number }}");
  });

  it("should never fail the pipeline over a review request", () => {
    const script = String(
      (load("review.yml").jobs.request?.steps?.[0] as { with?: { script?: string } } | undefined)?.with?.script,
    );
    expect(script).toContain("catch (error)");
    expect(script).toContain("core.warning");
  });
});

describe("Node.js version resolution", () => {
  const workflowFiles = fs.readdirSync(workflowsDir).filter((file) => file.endsWith(".yml") && !file.startsWith("."));

  // the input wins, then the project's .nvmrc, then forgejs's default, which must match what init pins
  for (const file of workflowFiles) {
    const content = fs.readFileSync(path.join(workflowsDir, file), "utf-8");
    if (!content.includes("actions/setup-node")) continue;

    it(`should resolve the version before every setup-node in ${file}`, () => {
      const setups = content.match(/uses: actions\/setup-node@\S+\n\s+with:\n\s+node-version: (.+)/g) ?? [];
      expect(setups.length).toBeGreaterThan(0);
      for (const setup of setups) expect(setup).toContain("${{ steps.node.outputs.version }}");
      const resolves = content.match(/else version=(\S+)/g) ?? [];
      expect(resolves).toHaveLength(setups.length);
      for (const resolve of resolves) expect(resolve).toBe(`else version=${NODE_VERSION}`);
      expect(content).toContain("elif [ -f .nvmrc ]");
    });
  }

  for (const file of workflowFiles) {
    const inputs = (yaml.load(fs.readFileSync(path.join(workflowsDir, file), "utf-8")) as Workflow).on?.workflow_call
      ?.inputs as Record<string, { default?: unknown }> | undefined;
    if (!inputs?.node_version) continue;
    it(`should leave node_version empty by default in ${file}`, () => {
      expect(inputs.node_version.default).toBe("");
    });
  }
});
