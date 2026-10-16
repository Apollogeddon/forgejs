// The generated .github/workflows/.index.yml: each job calls one forgejs pipeline, so a run page reads
// <pipeline> / <stage>. Pull requests run the checks, main runs release-please and, on a release, the checks
// again before shipping, and a weekly run patches vulnerable dependencies.

export type PipelineMode = "library" | "service" | "website";

export interface IndexWorkflowOptions {
  mode: PipelineMode;
  debian: boolean;
  docker: boolean;
  testing: boolean;
  versioning: boolean;
}

export const FORGEJS_WORKFLOWS = "apollogeddon/forgejs/.github/workflows";

const header = `\
name: index

on:
  push:
    branches: ["main"]
  pull_request:
    branches: ["main"]
  workflow_dispatch:
  # sent by the merge pipeline, as a merge it makes starts no push run on main
  repository_dispatch:
    types: [auto-merged]
  # weekly, for the patch pipeline; a manual run and an auto-merged dispatch patch too
  schedule:
    - cron: '17 3 * * 1'

concurrency:
  # a pull request's newer run replaces its older one; every other run has a group of its own, so a run on
  # main, running or queued, is never cancelled and a release is never created without being published
  group: \${{ github.workflow }}-\${{ github.head_ref || github.run_id }}
  cancel-in-progress: true

jobs:
`;

const released = "needs.version.outputs.new_release_published == 'true'";

// a GitHub Actions expression, kept out of template literals' own placeholder syntax
const expr = (expression: string) => ["$", "{{ ", expression, " }}"].join("");

export interface PipelineJob {
  id: string;
  comment?: string;
  needs?: string[];
  if?: string;
  pipeline: string;
  with?: Record<string, string | boolean>;
  permissions: Record<string, "read" | "write">;
}

function render(job: PipelineJob): string {
  const lines = job.comment ? [`  # ${job.comment}`] : [];
  lines.push(`  ${job.id}:`);
  if (job.needs?.length)
    lines.push(`    needs: ${job.needs.length === 1 ? job.needs[0] : `[${job.needs.join(", ")}]`}`);
  if (job.if) lines.push(`    if: ${expr(job.if)}`);
  lines.push(`    uses: ${FORGEJS_WORKFLOWS}/${job.pipeline}.yml@main`);
  const inputs = Object.entries(job.with ?? {});
  if (inputs.length) {
    lines.push("    with:");
    for (const [key, value] of inputs) lines.push(`      ${key}: ${value}`);
  }
  lines.push("    permissions:");
  for (const [key, value] of Object.entries(job.permissions)) lines.push(`      ${key}: ${value}`);
  return `${lines.join("\n")}\n`;
}

// Disabled standard features become pipeline inputs, so CI doesn't run what the project doesn't have:
// --no-testing turns off the test stage. --no-versioning leaves out the version job, and with it the
// release testing and publish; --no-linting needs nothing, as the lint stage skips Biome without a biome.json.
export function withPipelineInputs(cfg: Pick<IndexWorkflowOptions, "testing">): Record<string, boolean> {
  return cfg.testing ? {} : { run_tests: false };
}

// Docker is a job of its own after the checks, so projects without it don't carry a permanently
// skipped one: it builds on pull requests, and builds and pushes on a release.
export function withDocker(checks: string, versioning: boolean): PipelineJob {
  return {
    id: "docker",
    needs: versioning ? ["version", checks] : [checks],
    if: `!cancelled() && needs.${checks}.result == 'success'`,
    pipeline: "docker",
    with: versioning ? { push: expr(released), version: expr("needs.version.outputs.version") } : {},
    permissions: { contents: "read", packages: "write" },
  };
}

export function indexWorkflow(cfg: IndexWorkflowOptions): string {
  const checks = cfg.mode;
  const jobs: PipelineJob[] = [];

  if (cfg.versioning) {
    jobs.push({
      id: "version",
      comment: "release-please, on main",
      if: "github.event_name != 'pull_request' && github.event_name != 'schedule'",
      pipeline: "version",
      permissions: { contents: "write", "pull-requests": "write" },
    });
  }

  jobs.push({
    id: checks,
    comment: cfg.versioning
      ? "a pull request's checks, and on main a release's, before it ships"
      : "the checks, on pull requests and every push to main",
    ...(cfg.versioning ? { needs: ["version"] } : {}),
    if: cfg.versioning
      ? `!cancelled() && (github.event_name == 'pull_request' || ${released})`
      : "github.event_name != 'schedule'",
    pipeline: checks,
    with: withPipelineInputs(cfg),
    permissions: { contents: "read", packages: "read", "pull-requests": "write" },
  });

  const checkJobs: string[] = [checks];
  if (cfg.debian) {
    jobs.push({
      id: "debian",
      needs: [checks],
      if: `!cancelled() && needs.${checks}.result == 'success'`,
      pipeline: "debian",
      permissions: { contents: "read", packages: "read" },
    });
    checkJobs.push("debian");
  }
  if (cfg.docker) {
    jobs.push(withDocker(checks, cfg.versioning));
    checkJobs.push("docker");
  }

  if (cfg.versioning && cfg.mode === "library") {
    jobs.push({
      id: "publish",
      comment: "the release's package, to GitHub Packages",
      needs: ["version", checks],
      if: `!cancelled() && needs.${checks}.result == 'success' && ${released}`,
      pipeline: "publish",
      permissions: { contents: "read", packages: "write" },
    });
  } else if (cfg.versioning && cfg.debian) {
    jobs.push({
      id: "publish",
      comment: "the release's .deb, attached to the GitHub release",
      needs: ["version", "debian"],
      if: `!cancelled() && needs.debian.result == 'success' && ${released}`,
      pipeline: "publish",
      with: { package: false, assets: "debian-package", tag_name: expr("needs.version.outputs.tag_name") },
      // packages: write only because the skipped package stage asks for it, which GitHub checks all the same
      permissions: { contents: "write", packages: "write" },
    });
  }

  if (cfg.mode === "website") {
    jobs.push({
      id: "pages",
      comment: cfg.versioning ? "a release, to GitHub Pages" : "every change to main, to GitHub Pages",
      needs: cfg.versioning ? ["version", checks] : [checks],
      if: cfg.versioning
        ? `!cancelled() && needs.${checks}.result == 'success' && ${released}`
        : "github.ref == 'refs/heads/main' && github.event_name != 'pull_request'",
      pipeline: "pages",
      permissions: { pages: "write", "id-token": "write" },
    });
  }

  jobs.push({
    id: "patch",
    comment: "vulnerable dependencies updated on main: weekly, on a manual run, and after a Dependabot merge",
    if: "github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' || github.event_name == 'repository_dispatch'",
    pipeline: "patch",
    permissions: { contents: "write", packages: "read" },
  });

  jobs.push({
    id: "merge",
    comment: "Dependabot's pull requests: a review request, and a squash merge when the checks passed",
    needs: checkJobs,
    if: "!cancelled() && github.event_name == 'pull_request' && github.event.pull_request.user.login == 'dependabot[bot]'",
    pipeline: "merge",
    with: {
      checks_passed: expr("!contains(needs.*.result, 'failure') && !contains(needs.*.result, 'cancelled')"),
    },
    permissions: { contents: "write", "pull-requests": "write" },
  });

  return header + jobs.map(render).join("\n");
}

// A workflow that calls forgejs's pipelines, rather than one of the project's own
export function callsForgejs(content: string): boolean {
  return /apollogeddon\/forgejs\/\.github\/workflows\//i.test(content);
}
