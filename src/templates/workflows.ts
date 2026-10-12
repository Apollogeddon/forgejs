export const libraryWorkflow = `\
name: CI

on:
  push:
    branches: ["main"]
  pull_request:
    branches: ["main"]

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  # never cancel a run on main mid-release, or the release is created but never published
  cancel-in-progress: \${{ github.ref != 'refs/heads/main' }}

jobs:
  library:
    uses: apollogeddon/forgejs/.github/workflows/library.yml@main
    permissions:
      contents: write
      pull-requests: write
      packages: write
    with:
      auto_patch: true
`;

export const serviceWorkflow = `\
name: CI

on:
  push:
    branches: ["main"]
  pull_request:
    branches: ["main"]

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  # never cancel a run on main mid-release, or the release is created but never published
  cancel-in-progress: \${{ github.ref != 'refs/heads/main' }}

jobs:
  service:
    uses: apollogeddon/forgejs/.github/workflows/service.yml@main
    permissions:
      contents: write
      packages: read
      pull-requests: write
    with:
      auto_patch: true
`;

export const websiteWorkflow = `\
name: CI

on:
  push:
    branches: ["main"]
  pull_request:
    branches: ["main"]

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  # never cancel a run on main mid-release, or the release is created but never published
  cancel-in-progress: \${{ github.ref != 'refs/heads/main' }}

jobs:
  website:
    uses: apollogeddon/forgejs/.github/workflows/website.yml@main
    permissions:
      contents: write
      packages: read
      pages: write
      id-token: write
      pull-requests: write
    with:
      auto_patch: true
`;

export const debianWorkflow = `\
name: CI

on:
  push:
    branches: ["main"]
  pull_request:
    branches: ["main"]

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  # never cancel a run on main mid-release, or the release is created but never published
  cancel-in-progress: \${{ github.ref != 'refs/heads/main' }}

jobs:
  debian:
    uses: apollogeddon/forgejs/.github/workflows/debian.yml@main
    permissions:
      contents: write
      packages: read
      pull-requests: write
    with:
      auto_patch: true
`;

// Disabled standard features become pipeline inputs so CI doesn't run what the project doesn't have.
export function withPipelineInputs(workflow: string, inputs: Record<string, boolean>): string {
  const lines = Object.entries(inputs)
    .map(([key, value]) => `      ${key}: ${value}\n`)
    .join("");
  return workflow.replace("    with:\n", `    with:\n${lines}`);
}

// Docker is a separate job rather than part of the shared pipelines so projects without it
// don't carry a permanently skipped job; it runs after the pipeline and pushes on release.
export function withDocker(workflow: string): string {
  const pipeline = workflow.match(/^jobs:\n {2}([\w-]+):/m)?.[1];
  if (!pipeline) {
    throw new Error("withDocker: workflow has no pipeline job");
  }
  return `${workflow}
  docker:
    needs: ${pipeline}
    uses: apollogeddon/forgejs/.github/workflows/docker.yml@main
    permissions:
      contents: read
      packages: write
    with:
      push: \${{ github.ref == 'refs/heads/main' && needs.${pipeline}.outputs.new_release_published == 'true' }}
      version: \${{ needs.${pipeline}.outputs.version }}
`;
}
