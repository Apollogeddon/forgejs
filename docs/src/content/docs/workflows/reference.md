---
title: Workflow Job Reference
description: Execution flow and responsibilities of each job in the Forge.js workflow ecosystem.
---

This reference details the execution flow and responsibilities of each workflow.

## Pipeline Lifecycle

The workflows follow a modular design. The logical progression from code change to production release is:

1. **Quality Assurance** — `testing.yml` runs linting, security scanning, tests, and the build on every push.
2. **Versioning** — `version.yml` determines the next release version and creates a GitHub Release using release-please.
3. **Delivery** — `library.yml` (npm), `debian.yml` (Linux), or `website.yml` (GitHub Pages) publishes artifacts.

---

## default.yml

*The foundation. Used internally by other pipelines.*

- **`setup`** — Prepares Node.js, caches dependencies, performs a clean install (`npm ci`), and runs a security audit.
- **`auto-merge`** — Automatically merges Dependabot pull requests for minor and patch updates.

## quality.yml

*Ensures code standards are met.*

1. Calls → `default.yml` to prepare the environment.
2. **`secure`** — Runs Gitleaks and OSV scanning.
3. **`linting`** — Executes Biome linting and TypeScript type checking. *(Needs: setup)*

## testing.yml

*Full QA suite — the primary workflow for validating a change.*

1. Calls → `quality.yml` for linting and security checks.
2. **`test`** — Runs the Vitest suite and uploads code coverage reports. *(Needs: quality)*
3. **`build`** — Bundles the project with Tsup and uploads the `dist` artifact. *(Needs: quality)*

## service.yml

*Orchestrates the full pipeline for backend and website projects.*

1. Calls → `testing.yml` to validate and build the project.
2. Calls → `version.yml` to trigger a release on the main branch. *(Needs: testing)*

## version.yml

*Manages the release lifecycle.*

1. Calls → `default.yml` to prepare the environment.
2. **`release-please`** — Analyzes conventional commit history, bumps the version, generates a changelog, and creates a GitHub Release. *(Needs: setup)*

## library.yml

*Orchestrates npm publishing.*

1. Calls → `version.yml` to build and version the project.
2. **`publish`** — Publishes the package to GitHub Packages with OIDC-based provenance attestation. *(Needs: version)*

## debian.yml

*Orchestrates Debian packaging.*

1. Calls → `version.yml` to build and version the project.
2. **`build`** — Converts build artifacts into a `.deb` installer using Snodeb and uploads the package. *(Needs: version)*

## website.yml

*Deploys to GitHub Pages.*

1. Calls → `version.yml` to check if a new release was published.
2. **`deploy`** — Downloads the build artifact and deploys to GitHub Pages. Only runs when a new release is published on the main branch. *(Needs: version)*
