---
title: Job Reference
description: Job-by-job breakdown of each reusable workflow.
---

## Pipeline Overview

Every pipeline follows the same three stages:

1. **Quality & testing** — `testing.yml` runs `quality.yml`, the test suite and the build.
2. **Versioning** — `version.yml` runs release-please on the main branch.
3. **Delivery** — `library.yml` (GitHub Packages), `debian.yml` (Linux), `website.yml` (GitHub Pages) or `docker.yml` (GHCR) publishes the result.

Dependabot pull requests are auto-merged by `merge.yml` once testing passes.

`service.yml`, `website.yml` and `debian.yml` expose `version.yml`'s `new_release_published`, `version` and `tag_name` as outputs, which the generated `docker` job uses to decide when to push.

## Choosing runners

Every workflow takes a `runs_on` input, default `ubuntu-latest`, and passes it down to each workflow it calls, so every job runs on that runner label. Set it per repository to use self-hosted runners, e.g. from a repository variable: `runs_on: ${{ vars.RUNS_ON || 'ubuntu-latest' }}`.

`docker.yml`'s per-platform builds and its manifest merge always use GitHub-hosted runners: the builds because they need native Arm machines, the merge because it needs a Docker daemon.

## Checking once per change

By default the checks run on every push and pull request, so a change is checked on its PR, again on `main`, and again around its release. To check each change only on its pull request:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  schedule:
    - cron: '17 3 * * 1'   # weekly: a full check of main, and the OSV patch job

concurrency:
  group: ${{ github.workflow }}-${{ github.head_ref || github.run_id }}
  cancel-in-progress: true

jobs:
  service:
    uses: apollogeddon/forgejs/.github/workflows/service.yml@main
    with:
      test_on_push: false        # pushes to main only run release-please
      # test_release_prs: false  # also skip release-please's release PRs
```

- Pull requests run the full checks. A newer push cancels the run it replaces, and `main`'s own runs are never cancelled.
- Pushes to `main` run only release-please and anything after it.
- Release PRs run the checks unless `test_release_prs` is `false`. When they do run, they're the one place every change since the last release is checked together.
- Skipped jobs count as passed for required status checks.
- With `test_on_push: false`, turn off **Require branches to be up to date before merging**. Otherwise every PR is checked again before merge.
- `testing.yml`'s `patch` job runs on `main` after the checks, so with `test_on_push: false` only the weekly schedule runs it.

`library.yml`, `debian.yml` and `website.yml` take `test_on_push` too. There, a push to `main` runs release-please first, and only when it makes a release does it run the checks, the build, and the publish, package or deploy that ships what they built. A `website.yml` caller with `enable_versioning: false` deploys every push, so its pushes are always checked.

In that mode release-please tags the release before the push's checks run. If they fail, the tag and the GitHub release exist with nothing published, and need putting right by hand. So with these three, keep `test_release_prs: true`: the release PR is then checked with exactly what its merge ships.

## quality.yml

*Security and static analysis.*

1. **`secure`** — Gitleaks secret scan (skip with `enable_secrets: false`) and an OSV-Scanner dependency scan.
2. **`linting`** — `npm ci`, then Biome and TypeScript type checking.

## testing.yml

*The full QA suite.*

1. Calls → `quality.yml`.
2. **`testing`** — Runs the Vitest suite (skip with `run_tests: false`) and uploads the coverage report as `coverage-<artifact_name>`. *(Needs: quality)*
3. **`build`** — Writes `build_env_vars` to `.env`, runs the build, and uploads the result as the `artifact_name` artifact. *(Needs: quality, testing)*
4. **`patch`** — On `main` with `auto_patch` enabled, runs `osv-scanner fix` against `package-lock.json` and commits any security patches. *(Needs: quality, testing, build)*

## version.yml

*Manages the release lifecycle.*

1. **`release-please`** — On the main branch, opens or updates the release PR from Conventional Commits, and creates the tag and GitHub release when it merges. A `working_directory` other than `.` becomes release-please's `path`, so a package in a monorepo is versioned on its own.

Outputs `new_release_published`, `version` and `tag_name` for the delivery jobs.

## merge.yml

*Dependabot auto-merge.*

1. **`auto-merge`** — For pull requests opened by Dependabot, enables GitHub's auto-merge so the PR merges once required checks pass.

## service.yml

*Orchestrates the full pipeline for backend projects.*

1. Calls → `testing.yml` to validate and build the project.
2. Calls → `merge.yml` to auto-merge Dependabot PRs once testing passes. *(Needs: testing)*
3. Calls → `version.yml` to trigger a release on the main branch. Skip with `enable_versioning: false`. *(Needs: testing)*

Pass `run_tests: false` to skip the test suite. `service.yml`, `library.yml` and `debian.yml` all accept `run_tests` and `enable_versioning`, and `init` sets them for `--no-testing` and `--no-version`.

## library.yml

*Orchestrates publishing to GitHub Packages.*

1. Calls → `testing.yml`, `merge.yml` and `version.yml` as above.
2. **`publish`** — On a new release, downloads the build artifact and runs `npm publish` to GitHub Packages using `GITHUB_TOKEN`. Disable with `publish: false`. *(Needs: version)*

## debian.yml

*Orchestrates Debian packaging.*

1. Calls → `testing.yml`, `merge.yml`, `version.yml`, as `service.yml` does.
2. **`build`** — On a new release, downloads the build artifact, packages it with Snodeb (copying `.env.production` to `.env` if present), and uploads the `.deb` as the `debian-package` artifact. *(Needs: version)*

## website.yml

*Orchestrates the full pipeline for website projects and deploys to GitHub Pages.*

1. Calls → `testing.yml` to validate and build the site. Pass `run_tests: false` for sites without tests.
2. Calls → `merge.yml` to auto-merge Dependabot PRs once testing passes. Disable with `auto_merge: false`. *(Needs: testing)*
3. Calls → `version.yml` to check if a new release was published. Skip with `enable_versioning: false`. *(Needs: testing)*
4. **`deploy`** — Downloads the build artifact and deploys it to GitHub Pages. Runs on the main branch only and, when versioning is enabled, only when a new release is published. *(Needs: testing, version)*

`website.yml` was a deploy-only step before v3. Callers that ran `testing.yml` themselves and passed in a prebuilt artifact should now call `website.yml` alone.

## docker.yml

*Builds a Docker image for any number of platforms and publishes it to GitHub Container Registry.*

`init --docker` adds it to your `index.yml` as its own `docker` job after your pipeline job, so projects without Docker don't carry it. It builds on every run and pushes when the pipeline reports a new release. The job needs `packages: write` to push.

1. **`prepare`** — Resolves the image name (`ghcr.io/<owner>/<repo>`, lowercased) and turns `platforms` into a build matrix.
2. **`build`** — Builds each platform on its own runner. `linux/amd64` and `linux/arm64` build natively (`ubuntu-24.04-arm`); every other platform is emulated with QEMU. On pull requests the image is built but not pushed, so a broken Dockerfile fails the PR's checks. Make the `docker` job a required status check to stop Dependabot auto-merge on a failing build.
3. **`merge`** — On a new release, combines the per-platform images into one multi-platform manifest tagged `X.Y.Z`, `X.Y`, `X`, `sha-<commit>` and `latest`, with provenance and SBOM attestations. *(Needs: build)*

| Input | Default | Purpose |
| :--- | :--- | :--- |
| `push` | `false` | Push to GHCR; the generated job sets it for a new release on `main` |
| `version` | `''` | Release version used for the semver tags |
| `image` | `ghcr.io/<owner>/<repo>` | Image name override |
| `platforms` | `linux/amd64,linux/arm64` | Comma-separated platforms, e.g. `linux/amd64,linux/arm64,linux/arm/v7` |
| `native_arm` | `true` | Build arm64 on native Arm runners; set `false` to emulate (e.g. if Arm runners aren't available to a private repo) |

The generated Dockerfiles build platform-independent work once on the build host and only the platform-specific parts per target. Supported platforms follow the base images:

| Image | Platforms |
| :--- | :--- |
| Backend (`node:22-slim`, running as the non-root `node` user) | `linux/amd64`, `linux/arm64`, `linux/arm/v7`, `linux/ppc64le` |
| Website (`nginx:stable-alpine`) | `linux/amd64`, `linux/arm64`, `linux/arm/v6`, `linux/arm/v7`, `linux/386`, `linux/ppc64le`, `linux/riscv64`, `linux/s390x` |

Building locally needs a token with `read:packages` so `npm ci` can install `@apollogeddon` packages: `NODE_AUTH_TOKEN=<token> npm run docker:build`. Podman's Windows client can't pass build secrets, so on Windows with Podman run the build from inside the Podman machine or WSL.
