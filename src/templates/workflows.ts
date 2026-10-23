// The generated .github/workflows/.index.yml: each job calls one forgejs pipeline, so a run page reads
// <pipeline> / <stage>. Pull requests run the checks, and main runs release-please and, on a release, the checks
// again before shipping. Dependabot security updates, a repository setting, fix vulnerable dependencies.

export type PipelineMode = "library" | "service" | "website";

export interface IndexWorkflowOptions {
  mode: PipelineMode;
  debian: boolean;
  docker: boolean;
  // test and build on Windows and macOS too; only library and service checks have the stages
  windows: boolean;
  macos: boolean;
  testing: boolean;
  versioning: boolean;
}

const FORGEJS_WORKFLOWS = "apollogeddon/forgejs/.github/workflows";

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

concurrency:
  # a pull request's newer run replaces its older one; every other run has a group of its own, so a run on
  # main, running or queued, is never cancelled and a release is never created without being published
  group: \${{ github.workflow }}-\${{ github.event.pull_request.number || github.run_id }}
  cancel-in-progress: true

# nothing by default: every job grants what its pipeline needs
permissions: {}

jobs:
`;

const released = "needs.version.outputs.new_release_published == 'true'";
// false when the field is missing, as on a scheduled run, so that falls back to what a private repository can do
const PUBLIC = "github.event.repository.private == false";

// a GitHub Actions expression, kept out of template literals' own placeholder syntax
const expr = (expression: string) => ["$", "{{ ", expression, " }}"].join("");

interface PipelineJob {
  id: string;
  comment?: string;
  needs?: string[];
  if?: string;
  pipeline: string;
  with?: Record<string, string | boolean>;
  secrets?: Record<string, string>;
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
  const secrets = Object.entries(job.secrets ?? {});
  if (secrets.length) {
    lines.push("    secrets:");
    for (const [key, value] of secrets) lines.push(`      ${key}: ${value}`);
  }
  lines.push("    permissions:");
  for (const [key, value] of Object.entries(job.permissions)) lines.push(`      ${key}: ${value}`);
  return `${lines.join("\n")}\n`;
}

// Disabled standard features become pipeline inputs, so CI doesn't run what the project doesn't have:
// --no-testing turns off the test stage. --no-versioning leaves out the version job, and with it the
// release testing and publish; --no-linting needs nothing, as the lint stage skips Biome without a biome.json.
// --windows and --macos turn on those stages, which a private repository pays more for, so they're opt-in.
function withPipelineInputs(
  cfg: Pick<IndexWorkflowOptions, "testing" | "windows" | "macos">,
): Record<string, string | boolean> {
  return {
    ...(cfg.testing ? {} : { run_tests: false }),
    ...(cfg.windows ? { test_windows: "windows-latest" } : {}),
    ...(cfg.macos ? { test_macos: "macos-latest" } : {}),
  };
}

// Docker is a job of its own after the checks, so projects without it don't carry a permanently
// skipped one: it builds on pull requests, and builds and pushes on a release.
function withDocker(checks: string, versioning: boolean): PipelineJob {
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
      comment:
        "release-please, on main; with a GitHub App's token once RELEASE_APP_CLIENT_ID is set, so its pull requests run the checks",
      if: "github.event_name != 'pull_request'",
      pipeline: "version",
      // empty until the variable and secret are set, which leaves release-please on GITHUB_TOKEN
      with: { app_client_id: expr("vars.RELEASE_APP_CLIENT_ID") },
      secrets: { APP_PRIVATE_KEY: expr("secrets.RELEASE_APP_PRIVATE_KEY") },
      permissions: { contents: "write", "pull-requests": "write" },
    });
  }

  jobs.push({
    id: checks,
    comment: cfg.versioning
      ? "a pull request's checks, and on main a release's, before it ships"
      : "the checks, on pull requests and every push to main",
    ...(cfg.versioning ? { needs: ["version"] } : {}),
    ...(cfg.versioning ? { if: `!cancelled() && (github.event_name == 'pull_request' || ${released})` } : {}),
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
      comment:
        "the release's package, to GitHub Packages, attested only from a public repository, as a free plan needs",
      needs: ["version", checks],
      if: `!cancelled() && needs.${checks}.result == 'success' && ${released}`,
      pipeline: "publish",
      with: { attest: expr(PUBLIC) },
      permissions: { contents: "read", packages: "write", "id-token": "write", attestations: "write" },
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
      comment: `${cfg.versioning ? "a release" : "every change to main"}, to GitHub Pages, which a free plan serves only from a public repository; a paid plan can drop that check`,
      needs: cfg.versioning ? ["version", checks] : [checks],
      if: cfg.versioning
        ? `!cancelled() && needs.${checks}.result == 'success' && ${released} && ${PUBLIC}`
        : `github.ref == 'refs/heads/main' && github.event_name != 'pull_request' && ${PUBLIC}`,
      pipeline: "pages",
      permissions: { pages: "write", "id-token": "write" },
    });
  }

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
