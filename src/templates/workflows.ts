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
  auto-merge:
    uses: apollogeddon/forgejs/.github/workflows/merge.yml@main
    permissions:
      contents: write
      pull-requests: write
    secrets: inherit

  website:
    uses: apollogeddon/forgejs/.github/workflows/.pages.yml@main
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
