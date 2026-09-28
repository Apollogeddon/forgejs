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

*Orchestrates the full pipeline for backend projects.*

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

*Orchestrates the full pipeline for website projects and deploys to GitHub Pages.*

1. Calls → `testing.yml` to validate and build the site. Pass `run_tests: false` for sites without tests.
2. Calls → `merge.yml` to auto-merge Dependabot PRs once testing passes. Disable with `auto_merge: false`. *(Needs: testing)*
3. Calls → `version.yml` to check if a new release was published. Skip with `enable_versioning: false`. *(Needs: testing)*
4. **`deploy`** — Downloads the build artifact and deploys to GitHub Pages. Runs on the main branch only, and when versioning is enabled, only when a new release is published. *(Needs: testing, version)*

`website.yml` was a deploy-only step before v3. Callers that ran `testing.yml` themselves and passed in a prebuilt artifact should now call `website.yml` alone.

## docker.yml

*Builds a Docker image for any number of platforms and publishes it to GitHub Container Registry.*

Enable it on `service.yml`, `website.yml` or `debian.yml` with `docker: true` (`init --docker` does this for you). The calling job needs `packages: write` to push.

1. **`prepare`** — Resolves the image name (`ghcr.io/<owner>/<repo>`, lowercased) and turns `docker_platforms` into a build matrix.
2. **`build`** — Builds each platform on its own runner. `linux/amd64` and `linux/arm64` build natively (`ubuntu-24.04-arm`); every other platform is emulated with QEMU. On pull requests the image is built but not pushed, so a broken Dockerfile fails the checks and blocks auto-merge.
3. **`merge`** — On a new release, combines the per-platform images into one multi-platform manifest tagged `X.Y.Z`, `X.Y`, `X`, `sha-<commit>` and `latest`, with provenance and SBOM attestations. *(Needs: build)*

| Input (on the calling workflow) | Default | Purpose |
| :--- | :--- | :--- |
| `docker` | `false` | Build the image |
| `docker_platforms` | `linux/amd64,linux/arm64` | Comma-separated platforms, e.g. `linux/amd64,linux/arm64,linux/arm/v7` |
| `docker_native_arm` | `true` | Build arm64 on native Arm runners; set `false` to emulate (e.g. if Arm runners aren't available to a private repo) |

The generated Dockerfiles build platform-independent stages once on the build host (`--platform=$BUILDPLATFORM`) and only the platform-specific parts per target. Which platforms work depends on the base images:

| Image | Platforms |
| :--- | :--- |
| Backend (`node:22-slim`, running as the non-root `node` user) | `linux/amd64`, `linux/arm64`, `linux/arm/v7`, `linux/ppc64le` |
| Website (`nginx:stable-alpine`) | `linux/amd64`, `linux/arm64`, `linux/arm/v6`, `linux/arm/v7`, `linux/386`, `linux/ppc64le`, `linux/riscv64`, `linux/s390x` |

Building locally needs a token with `read:packages` so `npm ci` can install `@apollogeddon` packages: `NODE_AUTH_TOKEN=<token> npm run docker:build`. Podman's Windows client can't pass build secrets, so on Windows with Podman run the build from inside the Podman machine or WSL.
