import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import * as yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import * as templates from "../src/templates/index.js";
import { NODE_VERSION } from "../src/versions.js";

const workflowsDir = path.join(process.cwd(), ".github", "workflows");
const require = createRequire(import.meta.url);

type Step = {
  name?: string;
  id?: string;
  if?: string;
  uses?: string;
  run?: string;
  "working-directory"?: string;
  env?: Record<string, string>;
  with?: Record<string, unknown>;
};
type Job = {
  name?: string;
  if?: string;
  uses?: string;
  needs?: string | string[];
  with?: Record<string, unknown>;
  secrets?: Record<string, string>;
  permissions?: Record<string, string>;
  outputs?: Record<string, string>;
  concurrency?: { group?: string; "cancel-in-progress"?: boolean };
  steps?: Step[];
};
type Workflow = {
  name?: string;
  on: Record<string, unknown> & {
    workflow_call?: {
      inputs?: Record<string, { default?: unknown; required?: boolean; type?: string }>;
      outputs?: Record<string, { value?: string }>;
      secrets?: Record<string, { required?: boolean }>;
    };
    repository_dispatch?: { types?: string[] };
  };
  jobs: Record<string, Job>;
};

const files = fs.readdirSync(workflowsDir).filter((file) => file.endsWith(".yml"));
const roots = files.filter((file) => file.startsWith("."));
const pipelines = files.filter((file) => !file.startsWith("."));
const read = (file: string) => fs.readFileSync(path.join(workflowsDir, file), "utf-8");
const load = (file: string) => yaml.load(read(file)) as Workflow;
const steps = (file: string, job: string) => load(file).jobs[job]?.steps ?? [];
const step = (file: string, job: string, name: string) => steps(file, job).find((s) => s.name === name);

// The spec's stages: a run page reads <pipeline> / <stage>, the same words in every forge
const STAGES: Record<string, string[]> = {
  library: ["lint", "scan", "test", "build"],
  service: ["lint", "scan", "test", "test (windows)", "test (macos)", "test (databases)", "build"],
  website: ["lint", "scan", "test", "build", "check", "check (lighthouse)"],
  debian: ["build", "test"],
  docker: ["build", "test", "push"],
  version: ["release"],
  publish: ["package", "assets", "attest"],
  pages: ["deploy"],
  patch: ["update"],
  merge: ["review", "squash"],
};
// a stage, or a stage with a variant in brackets
const inVocabulary = (pipeline: string, name: string) =>
  (STAGES[pipeline] ?? []).includes(name) || (STAGES[pipeline] ?? []).includes(name.replace(/ \([^)]+\)$/, ""));
// a manual run patches too, and so does the auto-merged dispatch, straight after a Dependabot merge
const PATCH_EVENTS =
  "github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' || github.event_name == 'repository_dispatch'";
const kebab = (name: string) => name.replace(/[()]/g, "").trim().replace(/\s+/g, "-");

const MODES: Array<[string, templates.IndexWorkflowOptions]> = [];
for (const mode of ["library", "service", "website"] as const) {
  for (const debian of mode === "website" ? [false] : [false, true]) {
    for (const docker of [false, true]) {
      for (const versioning of [true, false]) {
        for (const testing of [true, false]) {
          const name = `${mode}${debian ? " debian" : ""}${docker ? " docker" : ""}${versioning ? "" : " no-versioning"}${testing ? "" : " no-testing"}`;
          MODES.push([name, { mode, debian, docker, versioning, testing }]);
        }
      }
    }
  }
}
const generated = MODES.map(([name, cfg]) => [name, templates.indexWorkflow(cfg)] as const);

describe("Workflow files", () => {
  it.each(files)("%s parses", (file) => {
    expect(() => yaml.load(read(file))).not.toThrow();
  });

  it("has the forge pipelines and one root workflow", () => {
    expect(pipelines.map((file) => file.replace(/\.yml$/, "")).sort()).toEqual(Object.keys(STAGES).sort());
    expect(roots).toEqual([".index.yml"]);
    expect(load(".index.yml").name).toBe("index");
  });
});

describe.each(pipelines)("Pipeline %s", (file) => {
  const pipeline = file.replace(/\.yml$/, "");
  const wf = load(file);

  it("is only ever called", () => {
    expect(Object.keys(wf.on)).toEqual(["workflow_call"]);
    expect(wf.name).toBe(pipeline);
  });

  // a pipeline calling another would add a third level to the run page's names
  it("calls no other pipeline", () => {
    for (const [id, job] of Object.entries(wf.jobs)) expect(job.uses, `${file}:${id}`).toBeUndefined();
  });

  it("names every job with a stage from the spec, its id the stage in kebab case", () => {
    for (const [id, job] of Object.entries(wf.jobs)) {
      expect(job.name, `${file}:${id} has no name`).toBeDefined();
      expect(inVocabulary(pipeline, String(job.name)), `${file}:${id} is named '${job.name}'`).toBe(true);
      expect(id).toBe(kebab(String(job.name)));
    }
  });

  it("names every step", () => {
    for (const [id, job] of Object.entries(wf.jobs)) {
      for (const s of job.steps ?? []) expect(s.name, `${file}:${id} has an unnamed step`).toBeTruthy();
    }
  });
});

// the caller's grant must cover every permission a called job asks for, or GitHub refuses the whole run
function expectGrantCovers(caller: string, job: Job, callee: Workflow) {
  const levels = { none: 0, read: 1, write: 2 } as Record<string, number>;
  for (const [id, called] of Object.entries(callee.jobs)) {
    for (const [scope, level] of Object.entries(called.permissions ?? {})) {
      expect(levels[job.permissions?.[scope] ?? "none"], `${caller} grants ${id} too little ${scope}`).toBeGreaterThanOrEqual(
        levels[level] ?? 0,
      );
    }
  }
}

function expectWiring(caller: string, wf: Workflow, resolve: (uses: string) => string | undefined) {
  for (const [id, job] of Object.entries(wf.jobs)) {
    if (!job.uses) {
      expect(id).toBe("changes");
      continue;
    }
    const callee = resolve(job.uses);
    expect(callee, `${caller}:${id} calls ${job.uses}`).toBeDefined();
    const pipeline = String(callee).replace(/\.yml$/, "");
    // the root job's id is the pipeline's name, and a variant names itself in brackets
    if (id === pipeline) expect(job.name).toBeUndefined();
    else expect(job.name, `${caller}:${id}`).toMatch(new RegExp(`^${pipeline} \\([^)]+\\)$`));
    const called = load(String(callee));
    const declared = Object.keys(called.on.workflow_call?.inputs ?? {});
    for (const input of Object.keys(job.with ?? {})) {
      expect(declared, `${caller}:${id} passes undeclared input '${input}' to ${callee}`).toContain(input);
    }
    for (const [input, spec] of Object.entries(called.on.workflow_call?.inputs ?? {})) {
      if (spec.required) expect(job.with, `${caller}:${id} misses required ${input}`).toHaveProperty(input);
    }
    const secrets = Object.keys(called.on.workflow_call?.secrets ?? {});
    for (const secret of Object.keys(job.secrets ?? {})) expect(secrets).toContain(secret);
    expect(job.secrets, `${caller}:${id} passes secrets`).toBeUndefined();
    expectGrantCovers(`${caller}:${id}`, job, called);
  }
  // every pipeline output a job reads is one its pipeline declares
  const text = yaml.dump(wf);
  for (const [, needed, output] of text.matchAll(/needs\.([\w-]+)\.outputs\.(\w+)/g)) {
    const callee = resolve(String(wf.jobs[String(needed)]?.uses));
    if (!callee) continue;
    expect(Object.keys(load(callee).on.workflow_call?.outputs ?? {}), `${caller} reads ${needed}.${output}`).toContain(output);
  }
}

describe("forgejs's own .index.yml", () => {
  const wf = load(".index.yml");

  it("calls only local pipelines, with inputs they declare and the permissions they need", () => {
    expectWiring(".index.yml", wf, (uses) =>
      uses.startsWith("./.github/workflows/") ? path.basename(uses) : undefined,
    );
  });

  it("keeps its change detection as a root job", () => {
    expect(wf.jobs.changes?.name).toBe("changes");
    expect(wf.jobs.changes?.outputs).toEqual({
      code: "${{ steps.diff.outputs.code }}",
      docs: "${{ steps.diff.outputs.docs }}",
    });
  });

  it("checks the tool as a library and the docs as a website, and attests what it publishes", () => {
    expect(wf.jobs.library?.uses).toBe("./.github/workflows/library.yml");
    expect(wf.jobs.website?.uses).toBe("./.github/workflows/website.yml");
    expect(wf.jobs.website?.with?.working_directory).toBe("docs");
    expect(wf.jobs.publish?.with?.attest).toBe(true);
    expect(wf.jobs.publish?.permissions).toEqual({
      contents: "read",
      packages: "write",
      "id-token": "write",
      attestations: "write",
    });
    expect(wf.jobs.pages?.with?.artifact_name).toBe(wf.jobs.website?.with?.artifact_name);
  });

  it("has the same concurrency as a generated .index.yml", () => {
    const generatedWf = yaml.load(generated[0]?.[1] ?? "") as { concurrency?: unknown };
    expect((wf as { concurrency?: unknown }).concurrency).toEqual(generatedWf.concurrency);
  });

  it("patches on the weekly schedule, a manual run and an auto-merged dispatch", () => {
    expect(wf.jobs.patch?.if).toBe(PATCH_EVENTS);
    expect(wf.jobs["patch-docs"]?.if).toBe(`\${{ !cancelled() && (${PATCH_EVENTS}) }}`);
  });

  it("patches the tool and the docs one after the other", () => {
    expect(wf.jobs["patch-docs"]?.needs).toBe("patch");
    expect(wf.jobs["patch-docs"]?.with?.working_directory).toBe("docs");
  });
});

describe.each(generated)("Generated .index.yml (%s)", (_name, text) => {
  const wf = yaml.load(text) as Workflow;

  it("calls forgejs's pipelines at @main, with inputs they declare and the permissions they need", () => {
    expectWiring("generated", wf, (uses) => {
      const match = uses.match(/^apollogeddon\/forgejs\/\.github\/workflows\/([\w-]+\.yml)@main$/);
      return match?.[1];
    });
  });

  it("listens for the merge pipeline's auto-merged dispatch", () => {
    const sent = read("merge.yml").match(/DISPATCH_TYPE: ([\w-]+)/)?.[1];
    expect(wf.on.repository_dispatch?.types).toEqual([sent]);
  });

  // each run outside a pull request has a group of its own, so a queued run on main is never cancelled
  it("cancels only a pull request's older run", () => {
    expect((wf as { concurrency?: Record<string, unknown> }).concurrency).toEqual({
      group: "${{ github.workflow }}-${{ github.head_ref || github.run_id }}",
      "cancel-in-progress": true,
    });
  });

  it("patches on the weekly schedule, a manual run and an auto-merged dispatch", () => {
    expect(wf.jobs.patch?.if).toBe(`\${{ ${PATCH_EVENTS} }}`);
    expect(Object.keys(wf.on)).toEqual(expect.arrayContaining(["schedule", "workflow_dispatch"]));
  });

  // only GitHub Pages and attestations need an OIDC token
  it("asks for id-token only to deploy Pages", () => {
    for (const [id, job] of Object.entries(wf.jobs)) {
      if (id !== "pages") expect(job.permissions?.["id-token"], id).toBeUndefined();
    }
  });
});

describe("Generated .index.yml per mode", () => {
  const jobsOf = (cfg: Partial<templates.IndexWorkflowOptions>) =>
    (
      yaml.load(
        templates.indexWorkflow({
          mode: "service",
          debian: false,
          docker: false,
          testing: true,
          versioning: true,
          ...cfg,
        }),
      ) as Workflow
    ).jobs;

  it.each([
    [{ mode: "library" as const }, ["version", "library", "publish", "patch", "merge"]],
    [{ mode: "service" as const }, ["version", "service", "patch", "merge"]],
    [{ mode: "website" as const }, ["version", "website", "pages", "patch", "merge"]],
    [{ mode: "service" as const, debian: true }, ["version", "service", "debian", "publish", "patch", "merge"]],
    [{ mode: "service" as const, docker: true }, ["version", "service", "docker", "patch", "merge"]],
    [{ mode: "library" as const, versioning: false }, ["library", "patch", "merge"]],
    [{ mode: "website" as const, versioning: false }, ["website", "pages", "patch", "merge"]],
  ])("%j has the jobs %j", (cfg, jobs) => {
    expect(Object.keys(jobsOf(cfg))).toEqual(jobs);
  });

  it("turns off the test stage for --no-testing", () => {
    expect(jobsOf({ testing: false }).service?.with).toEqual({ run_tests: false });
    expect(jobsOf({}).service?.with).toBeUndefined();
  });

  it("checks a release before shipping it, and every pull request", () => {
    expect(jobsOf({ mode: "library" }).library?.if).toContain("needs.version.outputs.new_release_published == 'true'");
    expect(jobsOf({ mode: "library" }).library?.if).toContain("github.event_name == 'pull_request'");
    expect(jobsOf({ mode: "library" }).publish?.if).toContain("needs.library.result == 'success'");
  });

  it("pushes the image only on a release", () => {
    const docker = jobsOf({ docker: true }).docker;
    expect(docker?.with?.push).toBe("${{ needs.version.outputs.new_release_published == 'true' }}");
    expect(jobsOf({ docker: true, versioning: false }).docker?.with).toBeUndefined();
  });

  it("attaches the .deb to the release", () => {
    expect(jobsOf({ debian: true }).publish?.with).toEqual({
      package: false,
      assets: "debian-package",
      tag_name: "${{ needs.version.outputs.tag_name }}",
    });
  });

  it("deploys every change to main when the site isn't versioned", () => {
    expect(jobsOf({ mode: "website", versioning: false }).pages?.if).toBe(
      "${{ github.ref == 'refs/heads/main' && github.event_name != 'pull_request' }}",
    );
  });

  it("merges a Dependabot pull request only when every check passed", () => {
    const merge = jobsOf({ debian: true, docker: true }).merge;
    expect(merge?.needs).toEqual(["service", "debian", "docker"]);
    expect(merge?.with?.checks_passed).toBe(
      "${{ !contains(needs.*.result, 'failure') && !contains(needs.*.result, 'cancelled') }}",
    );
  });

  it.each([
    ["uses: apollogeddon/forgejs/.github/workflows/library.yml@main", true],
    ["uses: Apollogeddon/forgejs/.github/workflows/service.yml@main", true],
    ["uses: someone/else/.github/workflows/ci.yml@v1", false],
    ["runs-on: ubuntu-latest", false],
  ])("recognises %j as calling forgejs: %s", (content, expected) => {
    expect(templates.callsForgejs(content)).toBe(expected);
  });
});

describe("Workflows an earlier forgejs generated", () => {
  const fixtures = path.join(process.cwd(), "tests", "fixtures", "legacy");
  const fixture = (name: string) => fs.readFileSync(path.join(fixtures, name), "utf-8");

  // main's generator before the split pipelines, in each mode
  it.each(["backend.yml", "library.yml", "website.yml", "debian.yml", "backend-docker.yml"])(
    "knows main's index.yml for %s",
    (name) => {
      expect(templates.isLegacyWorkflow(".github/workflows/index.yml", fixture(name))).toBe(true);
    },
  );

  it("knows the ci.yml releases before 2.3.2 wrote", () => {
    expect(templates.isLegacyWorkflow(".github/workflows/ci.yml", fixture("ci-v2.1.1.yml"))).toBe(true);
  });

  it("ignores line endings, trailing spaces and blank lines", () => {
    const text = fixture("library.yml").replace(/\n/g, "  \r\n\r\n");
    expect(templates.isLegacyWorkflow(".github/workflows/index.yml", text)).toBe(true);
  });

  it("doesn't know a changed one, or one under another name", () => {
    const changed = fixture("library.yml").replace("    with:\n", "    with:\n      runs_on: xerus\n");
    expect(templates.isLegacyWorkflow(".github/workflows/index.yml", changed)).toBe(false);
    expect(templates.isLegacyWorkflow(".github/workflows/build.yml", fixture("library.yml"))).toBe(false);
  });
});

describe("version.yml", () => {
  const wf = load("version.yml");
  const job = wf.jobs.release;
  const release = () => job?.steps?.find((s) => s.uses?.startsWith("googleapis/release-please-action"));
  const find = () => job?.steps?.find((s) => s.id === "config");

  it("should pass a sub-directory to release-please as the package path", () => {
    expect(release()?.with?.path).toContain("inputs.working_directory");
  });

  // release-please prefixes a sub-directory package's outputs with its path
  it.each(["release_created", "version", "tag_name"])("should read the package's own %s output", (key) => {
    expect(job?.outputs?.[key]).toContain(`format('{0}--${key}', inputs.working_directory)`);
  });

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
    expect(runFind(dir, [`${github}/release.json`])).toBe(`file=${github}/release.json\nmanifest=${github}/.release.json\n`);
  });

  it("should pass no config when the project has none", () => {
    expect(runFind(".", [])).toBe("");
  });

  it("should check out only the project's .github to find it", () => {
    const checkout = job?.steps?.find((s) => s.uses?.startsWith("actions/checkout"));
    expect(checkout?.with?.["sparse-checkout"]).toBe("${{ inputs.working_directory }}/.github");
    expect(checkout?.with?.["persist-credentials"]).toBe(false);
  });

  it("should release a Node.js package only when there is no config", () => {
    expect(release()?.with?.["release-type"]).toBe("${{ steps.config.outputs.file == '' && 'node' || '' }}");
    expect(release()?.with?.["config-file"]).toBe("${{ steps.config.outputs.file }}");
    expect(release()?.with?.["manifest-file"]).toBe("${{ steps.config.outputs.manifest }}");
    expect(release()?.with?.path).toContain("steps.config.outputs.file == ''");
  });

  // releases_created is true when any package is released, so it only counts for the root package
  it("should not report another package's release as this one's", () => {
    const published = String(wf.on.workflow_call?.outputs?.new_release_published?.value);
    expect(published).toContain("inputs.working_directory == '.' && (jobs.release.outputs.releases_created");
    expect(published.match(/releases_created/g)).toHaveLength(2);
  });
});

describe("Review requests on bots' pull requests", () => {
  const scriptOf = (s: Step | undefined) => String(s?.with?.script);

  it("should request a review on the release pull request release-please opened", () => {
    const request = step("version.yml", "release", "Request a review");
    expect(request?.if).toBe("steps.release.outputs.pr != ''");
    expect(request?.env?.PULL_REQUEST).toContain("fromJSON(steps.release.outputs.pr).number");
    expect(request?.env?.REVIEWERS).toBe("${{ inputs.reviewers }}");
  });

  it("should request a review on Dependabot's pull requests whether or not the checks passed", () => {
    const review = load("merge.yml").jobs.review;
    expect(review?.if).toContain("github.event.pull_request.user.login == 'dependabot[bot]'");
    expect(review?.if).not.toContain("checks_passed");
  });

  it("should never fail the pipeline over a review request", () => {
    for (const s of [step("version.yml", "release", "Request a review"), step("merge.yml", "review", "Request a review")]) {
      expect(scriptOf(s)).toContain("catch (error)");
      expect(scriptOf(s)).toContain("core.warning");
    }
    expect(scriptOf(step("version.yml", "release", "Request a review"))).toBe(
      scriptOf(step("merge.yml", "review", "Request a review")),
    );
  });
});

describe("Node.js version resolution", () => {
  // the input wins, then the project's .nvmrc, then forgejs's default, which must match what init pins
  for (const file of pipelines) {
    const content = read(file);
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

  for (const file of pipelines) {
    const inputs = load(file).on.workflow_call?.inputs;
    if (!inputs?.node_version) continue;
    it(`should leave node_version empty by default in ${file}`, () => {
      expect(inputs.node_version?.default).toBe("");
    });
  }
});

describe("Check pipelines", () => {
  const checkPipelines = ["library.yml", "service.yml", "website.yml"];

  // the stages a check pipeline shares are the same jobs in each
  it("should share their lint, scan, test and build stages", () => {
    for (const job of ["lint", "scan", "test", "build"]) {
      const library = load("library.yml").jobs[job];
      for (const file of checkPipelines) expect(load(file).jobs[job], `${file}:${job}`).toEqual(library);
    }
  });

  it("should keep the inputs consumers pass", () => {
    for (const file of checkPipelines) {
      const inputs = Object.keys(load(file).on.workflow_call?.inputs ?? {});
      expect(inputs).toEqual(
        expect.arrayContaining([
          "runs_on",
          "working_directory",
          "node_version",
          "enable_secrets",
          "run_tests",
          "build_env_vars",
          "artifact_name",
          "ref",
          "setup_go",
          "pre_build_command",
        ]),
      );
      expect(load(file).on.workflow_call?.secrets?.GH_TOKEN?.required).toBe(false);
    }
  });

  it.each(["lint", "scan", "test", "build"])("should check out the ref in the %s stage", (job) => {
    const checkout = steps("library.yml", job).find((s) => s.uses?.startsWith("actions/checkout"));
    expect(checkout?.with?.ref).toBe("${{ inputs.ref }}");
    expect(checkout?.with?.["persist-credentials"]).toBe(false);
  });

  it.each(["lint", "test", "build"])("should set up Go and run the pre-build command before installing in %s", (job) => {
    const list = steps("library.yml", job);
    const index = (name: string) => list.findIndex((s) => s.name === name);
    expect(index("Set up Node")).toBeLessThan(index("Set up Go"));
    expect(index("Set up Go")).toBeLessThan(index("Run the pre-build command"));
    expect(index("Run the pre-build command")).toBeLessThan(index("Install dependencies"));
    const hook = list[index("Run the pre-build command")];
    expect(hook?.if).toBe("inputs.pre_build_command != ''");
    // through the environment, never interpolated into the script
    expect(hook?.run).not.toContain("${{");
    expect(hook?.env?.GH_TOKEN).toBe("${{ secrets.GH_TOKEN }}");
    expect(list[index("Set up Go")]?.if).toBe("inputs.setup_go != ''");
  });

  it("should skip the test stage with run_tests false", () => {
    expect(load("library.yml").jobs.test?.if).toBe("inputs.run_tests");
  });
});

describe("Website site checks", () => {
  const website = load("website.yml");
  const check = website.jobs.check;
  const checkStep = (name: string) => check?.steps?.find((s) => s.name === name);

  // every input keeps what a caller that doesn't set it already gets
  it.each([
    ["ref", ""],
    ["setup_go", ""],
    ["pre_build_command", ""],
    ["base_path", ""],
    ["check_links", false],
    ["check_external_links", false],
    ["link_check_args", ""],
    ["check_accessibility", false],
    ["accessibility_paths", ""],
    ["accessibility_impact", "serious"],
  ])("should default website.yml's %s to %j", (input, value) => {
    expect(website.on.workflow_call?.inputs?.[input]?.default).toBe(value);
  });

  it("should check the uploaded build only when asked", () => {
    expect(check?.needs).toEqual(["build"]);
    expect(check?.if).toBe("inputs.check_links || inputs.check_accessibility");
    expect(checkStep("Download the build")?.with?.name).toBe("${{ inputs.artifact_name }}");
    expect(checkStep("Check links")?.if).toBe("inputs.check_links");
    for (const name of ["Install the accessibility checker", "Check accessibility"]) {
      expect(checkStep(name)?.if).toContain("inputs.check_accessibility");
    }
  });

  // runs the staging step on a scratch build, and returns what it outputs and where the files went
  const stage = (basePath: string) => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "forgejs-site-"));
    const temp = path.join(cwd, "temp");
    const output = path.join(cwd, "output");
    try {
      fs.mkdirSync(path.join(cwd, "build"), { recursive: true });
      fs.writeFileSync(path.join(cwd, "build", "index.html"), "<h1>hi</h1>");
      execFileSync("bash", ["-e", "-c", String(checkStep("Stage the site for checking")?.run)], {
        cwd,
        env: { ...process.env, BASE_PATH: basePath, BUILD: path.join(cwd, "build"), RUNNER_TEMP: temp, GITHUB_OUTPUT: output },
      });
      const outputs = Object.fromEntries(
        fs
          .readFileSync(output, "utf-8")
          .trim()
          .split("\n")
          .map((line) => line.split("=") as [string, string]),
      );
      return { outputs, served: fs.existsSync(path.join(outputs.root ?? "", outputs.base ?? "", "index.html")), temp };
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  };

  it.each([
    ["", "/"],
    ["/", "/"],
    ["my-site", "/my-site/"],
    ["/my-site", "/my-site/"],
    ["/my-site/", "/my-site/"],
    ["/a/b/", "/a/b/"],
  ])("should serve the build under base_path %j at %s", (basePath, base) => {
    const { outputs, served, temp } = stage(basePath);
    expect(outputs).toEqual({ root: path.join(temp, "site"), base });
    expect(served).toBe(true);
  });

  it("should check only internal links unless asked for external ones", () => {
    const args = String(checkStep("Check links")?.with?.args);
    expect(checkStep("Check links")?.uses).toMatch(/^lycheeverse\/lychee-action@v\d+$/);
    expect(args).toContain("${{ !inputs.check_external_links && '--offline' || '' }}");
    expect(args).toContain("--root-dir '${{ steps.site.outputs.root }}'");
    expect(checkStep("Check links")?.with?.fail).toBe(true);
  });

  it("should run the accessibility check whatever the link check found", () => {
    expect(checkStep("Check accessibility")?.if).toContain("!cancelled()");
  });

  it("should write an accessibility checker that parses", () => {
    const run = String(checkStep("Install the accessibility checker")?.run);
    const script = run.match(/<<'EOF'\n([\s\S]*?)\nEOF/)?.[1];
    expect(script).toContain("AxeBuilder");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forgejs-a11y-"));
    try {
      fs.writeFileSync(path.join(dir, "check.mjs"), String(script));
      expect(() => execFileSync(process.execPath, ["--check", path.join(dir, "check.mjs")])).not.toThrow();
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("pages.yml", () => {
  const deploy = load("pages.yml").jobs.deploy;

  it("should deploy one at a time, in a group a caller's own concurrency can't share", () => {
    expect(deploy?.concurrency?.group).toBe("pages-deploy");
    expect(deploy?.concurrency?.["cancel-in-progress"]).toBe(false);
  });

  it("should deploy the named build artifact with only the Pages permissions", () => {
    expect(deploy?.permissions).toEqual({ pages: "write", "id-token": "write" });
    expect(deploy?.steps?.[0]?.with?.name).toBe("${{ inputs.artifact_name }}");
    expect(deploy?.steps?.at(-1)?.name).toBe("Deploy to Pages");
  });
});

describe("publish.yml", () => {
  const wf = load("publish.yml");

  // the publish token's job holds nothing else; GitHub checks every job's permissions before a run, so the stages a
  // caller may leave off ask for none and take the caller's grant
  it("should give package only its own permissions, and assets and attest the caller's", () => {
    expect(wf.jobs.package?.permissions).toEqual({ contents: "read", packages: "write" });
    expect(wf.jobs.assets?.permissions).toBeUndefined();
    expect(wf.jobs.attest?.permissions).toBeUndefined();
  });

  it("should publish the packed tarball and upload that same file", () => {
    expect(step("publish.yml", "package", "Publish to GitHub Packages")?.run).toContain(
      'npm publish "$TARBALL" --ignore-scripts',
    );
    expect(step("publish.yml", "package", "Publish to GitHub Packages")?.env?.TARBALL).toBe(
      "${{ steps.pack.outputs.tarball }}",
    );
    expect(step("publish.yml", "package", "Upload the published tarball")?.with?.path).toBe(
      "${{ steps.pack.outputs.tarball }}",
    );
    expect(step("publish.yml", "package", "Upload the published tarball")?.with?.name).toBe(
      "${{ inputs.artifact_name }}-package",
    );
  });

  it("should pack without running lifecycle scripts, into a directory of its own", () => {
    expect(step("publish.yml", "package", "Pack")?.run).toContain('npm pack --ignore-scripts --pack-destination "$dir"');
  });

  it("should expose whether it published, and where the tarball is", () => {
    const outputs = wf.on.workflow_call?.outputs ?? {};
    expect(outputs.published?.value).toBe("${{ jobs.package.outputs.published }}");
    expect(outputs.package_artifact?.value).toBe("${{ jobs.package.outputs.artifact }}");
  });

  it("should attest what the other stages shipped, only when asked", () => {
    const attest = wf.jobs.attest;
    expect(attest?.needs).toEqual(["package", "assets"]);
    expect(attest?.if).toContain("inputs.attest");
    expect(wf.on.workflow_call?.inputs?.attest?.default).toBe(false);
    expect(attest?.steps?.at(-1)?.uses).toMatch(/^actions\/attest-build-provenance@v\d+$/);
    expect(attest?.steps?.at(-1)?.with?.["subject-path"]).toBe("${{ runner.temp }}/attest/*");
  });

  it("should attach assets only when given an artifact and a release", () => {
    expect(wf.jobs.assets?.if).toBe("inputs.assets != ''");
    expect(String(step("publish.yml", "assets", "Upload the assets to the release")?.with?.script)).toContain(
      "getReleaseByTag",
    );
  });
});

describe("Main's pipeline after an auto-merge", () => {
  const merge = read("merge.yml");
  const sent = merge.match(/DISPATCH_TYPE: ([\w-]+)/)?.[1];

  it("sends a repository_dispatch once it merges", () => {
    expect(sent).toBeTruthy();
    expect(merge).toContain("createDispatchEvent");
  });

  it("runs forgejs's own .index.yml on it", () => {
    expect(load(".index.yml").on.repository_dispatch?.types).toEqual([sent]);
  });
});

describe("OSV scan", () => {
  const scan = step("library.yml", "scan", "Scan with OSV");
  const report = step("library.yml", "scan", "Report OSV findings");

  // runs the report step's github-script body with a stand-in for its core API
  async function runReport(status: number, results: unknown[] | null = [], enforce = true) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forgejs-osv-"));
    const file = path.join(dir, "osv.json");
    if (results) fs.writeFileSync(file, JSON.stringify({ results }));
    const calls: Record<string, string[]> = { info: [], warning: [], error: [], setFailed: [] };
    const record = (kind: string) => (message: string) => calls[kind]?.push(message);
    const core = {
      info: record("info"),
      warning: record("warning"),
      error: record("error"),
      setFailed: record("setFailed"),
      summary: { addHeading: () => core.summary, addTable: () => core.summary, write: async () => {} },
    };
    const env = { ...process.env };
    Object.assign(process.env, {
      OSV_STATUS: String(status),
      OSV_REPORT: file,
      OSV_ENFORCE: String(enforce),
      GITHUB_WORKSPACE: dir,
    });
    try {
      const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
      await new AsyncFunction("require", "core", String(report?.with?.script))(require, core);
    } finally {
      process.env = env;
      fs.rmSync(dir, { recursive: true, force: true });
    }
    return calls;
  }

  const lockfile = (dir = "/w") => ({ source: { path: `${dir}/package-lock.json` } });
  const finding = (id: string, maxSeverity: string, rating?: string) => ({
    package: { name: `pkg-${id}`, version: "1.0.0" },
    vulnerabilities: [{ id, summary: `advisory ${id}`, database_specific: rating ? { severity: rating } : {} }],
    groups: [{ ids: [id], max_severity: maxSeverity }],
  });

  it("should never swallow the scanner's result", () => {
    expect(scan?.run).not.toContain("|| true");
    expect(scan?.run).toContain("--format json");
    expect(report?.env?.OSV_STATUS).toBe("${{ steps.osv.outputs.status }}");
    expect(report?.env?.OSV_ENFORCE).toBe("${{ github.event_name == 'pull_request' }}");
  });

  it("should annotate a high finding outside a pull request, so the patch pipeline still runs", async () => {
    const calls = await runReport(1, [{ ...lockfile(), packages: [finding("GHSA-high", "9.8")] }], false);
    expect(calls.error).toEqual([expect.stringContaining("GHSA-high")]);
    expect(calls.setFailed).toEqual([]);
    expect(calls.warning).toEqual([expect.stringContaining("fails pull requests")]);
  });

  it("should fail on a high or critical finding and annotate the rest", async () => {
    const calls = await runReport(1, [{ ...lockfile(), packages: [finding("GHSA-high", "8.1"), finding("GHSA-low", "5.3")] }]);
    expect(calls.error).toEqual([expect.stringContaining("GHSA-high")]);
    expect(calls.warning).toEqual([expect.stringContaining("GHSA-low")]);
    expect(calls.setFailed).toEqual([expect.stringContaining("1 high or critical vulnerability")]);
  });

  it("should only warn when nothing is high or critical", async () => {
    const calls = await runReport(1, [{ ...lockfile(), packages: [finding("GHSA-moderate", "", "MODERATE")] }]);
    expect(calls.warning).toHaveLength(1);
    expect(calls.setFailed).toEqual([]);
  });

  it("should use the advisory's rating when it has no CVSS score", async () => {
    const calls = await runReport(1, [{ ...lockfile(), packages: [finding("GHSA-critical", "", "CRITICAL")] }]);
    expect(calls.setFailed).toHaveLength(1);
  });

  it.each([
    [0, 0],
    [128, 0],
  ])("should pass when the scanner exits %i", async (status) => {
    const calls = await runReport(status);
    expect(calls.setFailed).toEqual([]);
    expect(calls.warning).toEqual([]);
  });

  it.each([
    [127, []],
    [1, null],
  ])("should warn, not fail, when the scanner exits %i with %j results", async (status, results) => {
    const calls = await runReport(status, results);
    expect(calls.warning).toEqual([expect.stringContaining("couldn't finish")]);
    expect(calls.setFailed).toEqual([]);
  });
});

describe("Dependabot auto-merge", () => {
  // the author alone would merge someone else's push to Dependabot's branch, and the actor alone
  // a pull request someone else opened that Dependabot then updated
  it("should gate on Dependabot both opening the pull request and making its latest change, after the checks", () => {
    const gate = String(load("merge.yml").jobs.squash?.if);
    expect(gate).toMatch(/^inputs\.checks_passed && /);
    expect(gate).toContain("github.event.pull_request.user.login == 'dependabot[bot]' && ");
    expect(gate).toContain("github.actor == 'dependabot[bot]' && ");
    expect(gate).toContain("!startsWith(github.head_ref, 'dependabot/github_actions/')");
    expect(gate).not.toContain("||");
    expect(load("merge.yml").on.workflow_call?.inputs?.checks_passed?.default).toBe(false);
  });
});

describe("Package checks", () => {
  const list = steps("library.yml", "build");
  const checks = list.find((s) => s.name === "Check the package");

  function runChecks(scripts: Record<string, string>) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forgejs-checks-"));
    try {
      fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({ name: "x", scripts }));
      return execFileSync("bash", ["-e", "-c", String(checks?.run)], { cwd: dir, encoding: "utf-8" });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  it("should run after the build, which publint checks", () => {
    const index = (name: string) => list.findIndex((s) => s.name === name);
    expect(index("Check the package")).toBeGreaterThan(index("Build"));
  });

  it("should pass a project that defines neither script", () => {
    expect(() => runChecks({})).not.toThrow();
  });

  it("should run publint and docs:check when the project defines them", () => {
    const output = runChecks({ publint: "echo ran-publint", "docs:check": "echo ran-docs-check" });
    expect(output).toContain("ran-publint");
    expect(output).toContain("ran-docs-check");
  });

  it.each(["publint", "docs:check"])("should fail when %s fails", (script) => {
    expect(() => runChecks({ [script]: "exit 3" })).toThrow();
  });
});

describe("docker.yml platforms", () => {
  // runs the build stage's planning step and returns its outputs
  function plan(platforms: string, nativeArm = true, endpoint = "", image = "") {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "forgejs-docker-"));
    const output = path.join(dir, "output");
    try {
      execFileSync("bash", ["-e", "-c", String(step("docker.yml", "build", "Resolve the image and platforms")?.run)], {
        env: {
          ...process.env,
          IMAGE: image,
          REPOSITORY: "Owner/Repo",
          PLATFORMS: platforms,
          NATIVE_ARM: String(nativeArm),
          ENDPOINT: endpoint,
          GITHUB_OUTPUT: output,
        },
      });
      return Object.fromEntries(
        fs
          .readFileSync(output, "utf-8")
          .trim()
          .split("\n")
          .map((line) => line.split("=") as [string, string]),
      );
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  it.each([
    ["linux/amd64,linux/arm64", true, "", "linux/amd64", "false"],
    ["linux/amd64, linux/arm64", false, "", "linux/amd64,linux/arm64", "true"],
    ["linux/amd64,linux/arm64,linux/arm/v7", true, "", "linux/amd64,linux/arm/v7", "true"],
    ["linux/arm64", true, "", "", "false"],
    ["linux/amd64,linux/arm64", true, "tcp://builder:1234", "linux/amd64,linux/arm64", "true"],
  ])("should build %j (native arm %s, BuildKit %j) as %j", (platforms, nativeArm, endpoint, expected, emulate) => {
    const outputs = plan(platforms, nativeArm, endpoint);
    expect(outputs.platforms ?? "").toBe(expected);
    expect(outputs.emulate).toBe(emulate);
    // GHCR rejects uppercase repository names
    expect(outputs.image).toBe("ghcr.io/owner/repo");
  });

  it("should build arm64 natively only when it's asked for", () => {
    expect(load("docker.yml").jobs["build-arm64"]?.if).toContain("inputs.native_arm");
    expect(load("docker.yml").jobs.push?.if).toContain("needs.build-arm64.result != 'failure'");
  });
});
