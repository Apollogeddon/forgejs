# Workflows Overview

This directory contains reusable GitHub Actions workflows designed for Node.js projects. These provide a modular CI/CD pipeline covering quality checks, testing, building, versioning, publishing, and Debian package creation.

## Setup Guide

Reference workflows using the `uses` keyword in your GitHub Actions workflow files.

### Usage Examples

**Basic Testing** — For projects requiring only test execution on push:

```yaml
jobs:
  testing:
    uses: apollogeddon/forgejs/.github/workflows/testing.yml@main
```

**Full Versioning** — For applications requiring versioning and release management:

```yaml
jobs:
  version:
    uses: apollogeddon/forgejs/.github/workflows/version.yml@main
    secrets:
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**NPM Publishing** — For libraries publishing to an npm registry:

```yaml
jobs:
  publish:
    uses: apollogeddon/forgejs/.github/workflows/library.yml@main
    with:
      artifact_name: 'my-lib-dist'
    secrets:
      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Common Inputs

| Input | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `working_directory` | string | `'.'` | Path to the directory containing `package.json`. |
| `node_version` | string | `'22'` | The version of Node.js to use. |
| `artifact_name` | string | `'dist'` | Name of the artifact to pass between build and publish/package steps. Available in `build`, `library`, and `debian` workflows. |
| `enable_secrets` | boolean | `true` | Controls whether secrets scanning (Gitleaks) is enabled. |

## Common Secrets

- **`NPM_TOKEN`**: Required for publishing to private npm registries via `library.yml`.
- **`GITHUB_TOKEN`**: Automatically provided. Required for `semantic-release`, GitHub Packages, and Dependabot automation.

## Required Permissions

The caller workflow must possess necessary permissions:

```yaml
permissions:
  contents: write       # Required for semantic-release (tagging, changelog)
  packages: write       # Required for publishing to GitHub Packages
  id-token: write       # Required for provenance generation
  security-events: write # Required for uploading Sarif reports (Gitleaks)
```
