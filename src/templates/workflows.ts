export const libraryWorkflow = `\
name: CI

on:
  push:
    branches: ["main"]
  pull_request:
    branches: ["main"]

jobs:
  library:
    uses: apollogeddon/forgejs/.github/workflows/library.yml@main
    permissions:
      contents: write
      pull-requests: write
      packages: write
      id-token: write
    with:
      node_version: '22'
      auto_patch: true
    secrets: inherit
`;

export const serviceWorkflow = `\
name: CI

on:
  push:
    branches: ["main"]
  pull_request:
    branches: ["main"]

jobs:
  service:
    uses: apollogeddon/forgejs/.github/workflows/service.yml@main
    permissions:
      contents: write
      pull-requests: write
    with:
      node_version: '22'
      auto_patch: true
    secrets: inherit
`;

export const websiteWorkflow = `\
name: CI

on:
  push:
    branches: ["main"]
  pull_request:
    branches: ["main"]

jobs:
  website:
    uses: apollogeddon/forgejs/.github/workflows/website.yml@main
    permissions:
      contents: write
      pages: write
      id-token: write
      pull-requests: write
    with:
      node_version: '22'
      auto_patch: true
    secrets: inherit
`;

export const debianWorkflow = `\
name: CI

on:
  push:
    branches: ["main"]
  pull_request:
    branches: ["main"]

jobs:
  debian:
    uses: apollogeddon/forgejs/.github/workflows/debian.yml@main
    permissions:
      contents: write
      pull-requests: write
    with:
      node_version: '22'
      auto_patch: true
    secrets: inherit
`;

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
    secrets: inherit
`;
}
