---
title: Job reference
description: Job-by-job breakdown of each reusable workflow.
---

This page describes the jobs in each reusable workflow and the inputs specific to it. For the generated `index.yml` and the inputs every pipeline shares, see the [workflows overview](/forgejs/docs/workflows/overview).

## Pipeline stages

Every pipeline follows the same three stages:

1. **Quality and testing:** `testing.yml` runs `quality.yml`, the test suite and the build.
2. **Versioning:** `version.yml` runs release-please on the main branch.
3. **Delivery:** `library.yml` (GitHub Packages), `debian.yml` (`.deb` package), `website.yml` (GitHub Pages) or `docker.yml` (GHCR) publishes the result.

`merge.yml` auto-merges Dependabot pull requests once testing passes, except GitHub Actions updates. `review.yml` requests a review on Dependabot's and release-please's pull requests, so they reach your review requests in a private repository too.

`service.yml`, `website.yml` and `debian.yml` expose `version.yml`'s `new_release_published`, `version` and `tag_name` as outputs, which the generated `docker` job uses to decide when to push.

## Choosing runners

Every workflow takes a `runs_on` input, default `ubuntu-latest`, and passes it down to each workflow it calls, so every job runs on that runner label. To use self-hosted runners, set it per repository, for example from a repository variable: `runs_on: ${{ vars.RUNS_ON || 'ubuntu-latest' }}`.

`docker.yml`'s per-platform builds and its manifest merge use GitHub-hosted runners: the builds because they need native Arm machines, the merge because it needs a Docker daemon. With `buildkit_endpoint` set, it builds every platform in one job on `runs_on` instead, against a remote BuildKit, so self-hosted runners without a Docker daemon can build and push multi-platform images.

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
    permissions:
      contents: write
      packages: read
      pull-requests: write
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

In that mode release-please tags the release before the push's checks run. If they fail, the tag and the GitHub release exist with nothing published, and need putting right by hand. So with these three, keep `test_release_prs: true`: the release PR is then checked with exactly what its merge ships. release-please opens it with `GITHUB_TOKEN`, which doesn't start workflow runs, so approve its run (or push to its branch) before merging it.

## quality.yml

*Security and static analysis.*

1. **`secure`**: Gitleaks secret scan (skip with `enable_secrets: false`) and an OSV-Scanner dependency scan. On a pull request, a high or critical finding (a CVSS score of 7 or more, or GitHub's rating when an advisory has no score) fails the job, so a change can't add one. Elsewhere, such as on `main` or a release, it's an error annotation that doesn't fail the job: an advisory published against a dependency you already have shouldn't stop releases, and the `patch` job, which only runs when the checks pass, can then update it. Lower findings are warning annotations, and every finding is listed in the job summary. If the scanner can't run, for example because OSV's API is unreachable, the job warns and passes. To accept a finding you can't fix yet, list it in an [`osv-scanner.toml`](https://google.github.io/osv-scanner/configuration/) beside the lockfile:

   ```toml
   [[IgnoredVulns]]
   id = "GHSA-xxxx-xxxx-xxxx"
   ignoreUntil = 2026-12-31
   reason = "No fixed version yet; the vulnerable function isn't called"
   ```
2. **`linting`**: `npm ci`, then `biome ci` and `npm run type`. Runs `website.yml`'s [pre-build command](#generating-content-before-the-build) first, if set.

## testing.yml

*The full QA suite.*

1. Calls → `quality.yml`.
2. **`testing`**: Runs the Vitest suite (skip with `run_tests: false`) and uploads the coverage report as `coverage-<artifact_name>`. *(Needs: quality)*
3. **`build`**: Writes `build_env_vars` to `.env`, runs the build, then the project's `publint` and `docs:check` scripts when it defines them, and uploads the result as the `artifact_name` artifact. With `website.yml`'s [site checks](#site-checks) turned on, it then checks the built site's links and accessibility. *(Needs: quality; runs alongside testing)*
4. **`patch`**: On `main` with `auto_patch` enabled, runs `osv-scanner fix` against `package-lock.json` and commits any security patches. *(Needs: quality, testing, build)*

## version.yml

*Manages the release lifecycle.*

1. **`release-please`**: On the main branch, opens or updates the release PR from Conventional Commits, and creates the tag and GitHub release when it merges. A `working_directory` other than `.` becomes release-please's `path`, so a package in a monorepo is versioned on its own, tagged with its `package.json` name (`api-v1.2.3`). If the project has a `.github/release.json` and `.github/.release.json` under `working_directory`, release-please runs from them instead (see [release-please: versioning](/forgejs/docs/configuration#release-please-versioning)). The job checks out only that `.github` directory to look for them.

2. **`review`**: When release-please opened or updated a release PR, calls → `review.yml` to request a review on it. *(Needs: release-please)*

Outputs `new_release_published`, `version` and `tag_name` for the delivery jobs: those of the `working_directory` package, not of any other package released in the same run.

## merge.yml

*Dependabot auto-merge.*

1. **`auto-merge`**: For pull requests opened by Dependabot, when Dependabot also made the latest change (someone else's push to its branch waits for a person), enables GitHub's auto-merge so the PR merges once required checks pass. If the PR can already be merged, it merges it straight away. It squash-merges, so release-please lists each update once: a merge commit repeats the pull request's title, and release-please reads that as a second change. Merge your own pull requests the same way, with **Squash and merge**. GitHub Actions updates (branches starting `dependabot/github_actions/`) are skipped and left for a person to merge: they change workflow files, which `GITHUB_TOKEN` can't merge. Once the pull request has merged, it sends the `auto-merged` `repository_dispatch` event, so a workflow listening for it runs on `main`: a merge made with `GITHUB_TOKEN` starts no push run. When it enabled auto-merge rather than merging, it waits up to 12 minutes for the merge before sending it. See [Secrets](/forgejs/docs/workflows/overview#secrets).

## review.yml

*Review requests on bots' pull requests.*

1. **`request`**: Requests a review on a pull request from `reviewers`, or from the repository's owner when `reviewers` is empty and the owner is a user (an organisation names its reviewers through the input). GitHub only requests code owners' reviews in a private repository on a paid plan, so without this, Dependabot's and release-please's pull requests in a private repository on GitHub Free never reach your review requests. A failed request logs a warning and never fails the pipeline.

The pipeline workflows call it on Dependabot's pull requests as they open, before the checks, so a failing update reaches you too; `version.yml` calls it on the release PR. Dependabot updates that `merge.yml` merges still leave your review requests once merged.

| Input | Default | Description |
| :--- | :--- | :--- |
| `pull_request` | `''` | The pull request to request a review on; empty means the one that triggered the run |
| `reviewers` | `''` | Comma-separated logins to request; empty means the repository's owner |

## service.yml

*Orchestrates the full pipeline for backend projects.*

1. Calls → `testing.yml` to validate and build the project.
2. Calls → `review.yml` on Dependabot's pull requests, to request your review.
3. Calls → `merge.yml` to auto-merge Dependabot PRs once testing passes. *(Needs: testing)*
4. Calls → `version.yml` to trigger a release on the main branch. Skip with `enable_versioning: false`. *(Needs: testing)*

Pass `run_tests: false` to skip the test suite. Every pipeline workflow accepts `run_tests` and `enable_versioning`, and `init` sets them for `--no-testing` and `--no-versioning`.

## library.yml

*Orchestrates publishing to GitHub Packages.*

1. Calls → `testing.yml`, `review.yml`, `merge.yml` and `version.yml` as above.
2. **`publish`**: On a new release, downloads the build artifact, packs it and publishes the tarball to GitHub Packages as is, using `GITHUB_TOKEN`. Nothing is installed and lifecycle scripts (`prepublishOnly`, `prepare`) don't run, so no dependency code runs while the publish token is set; run those checks in your build or tests instead. It then uploads the published tarball as the `<artifact_name>-package` artifact, for [`attest.yml`](#attestyml). Disable with `publish: false`. *(Needs: version)*

Outputs `published` (`'true'` when this run published the package) and `package_artifact` (the name of the artifact holding the published tarball).

## attest.yml

*Build provenance for a published package.*

1. **`attest`**: Downloads the `artifact` input's artifact and attests the build provenance of each file in it with [`actions/attest-build-provenance`](https://github.com/actions/attest-build-provenance): a signed statement, kept by GitHub, of the repository, commit and workflow run that built it.

npm's own `--provenance` flag only works with the public npm registry, which GitHub Packages isn't, so a library attests the tarball it published instead. Add it to your `index.yml` as its own job after the library job:

```yaml
jobs:
  library:
    # ...as generated
  provenance:
    needs: library
    if: needs.library.outputs.published == 'true'
    uses: apollogeddon/forgejs/.github/workflows/attest.yml@main
    permissions:
      contents: read
      id-token: write
      attestations: write
    with:
      artifact: ${{ needs.library.outputs.package_artifact }}
```

It's a separate workflow, not an input of `library.yml`, because GitHub checks a called workflow's permissions against its caller's before running anything: a job in `library.yml` asking for `id-token: write` would stop every library pipeline that doesn't grant it, even with the job turned off. Artifact attestations are free in public repositories; a private repository needs GitHub Enterprise Cloud. It works for any artifact, such as `debian.yml`'s `debian-package`.

To check a published package, fetch its tarball and verify it against your repository. The attestation is signed by this workflow, so name forgejs as the signer:

```bash
npm pack @<owner>/<name>@<version>
gh attestation verify <owner>-<name>-<version>.tgz --repo <owner>/<repo> --signer-repo apollogeddon/forgejs
```

A package published to the public npm registry from your own workflow can use `npm publish --provenance` instead, which needs `id-token: write` too.

| Input | Default | Description |
| :--- | :--- | :--- |
| `artifact` | *(required)* | The artifact whose files to attest, e.g. `library.yml`'s `package_artifact` output |

## debian.yml

*Orchestrates Debian packaging.*

1. Calls → `testing.yml`, `review.yml`, `merge.yml` and `version.yml`, as `service.yml` does.
2. **`build`**: On a new release, downloads the build artifact, packages it with Snodeb (copying `.env.production` to `.env` if present), and uploads the `.deb` as the `debian-package` artifact. *(Needs: version)*

## website.yml

*Orchestrates the full pipeline for website projects and deploys to GitHub Pages.*

1. Calls → `testing.yml` to validate and build the site. Pass `run_tests: false` for sites without tests.
2. Calls → `review.yml` on Dependabot's pull requests, to request your review.
3. Calls → `merge.yml` to auto-merge Dependabot PRs once testing passes. Disable with `auto_merge: false`. *(Needs: testing)*
4. Calls → `version.yml` to check whether a new release was published. Skip with `enable_versioning: false`. *(Needs: testing)*
5. **`deploy`**: Downloads the build artifact and deploys it to GitHub Pages. Runs on the main branch only and, when versioning is enabled, only when a new release is published. Deploys run one at a time, in the `pages-deploy` concurrency group: a newer deploy waits for a running one, and replaces one still waiting. The group isn't `pages`, the one GitHub's starter Pages workflow uses at workflow level, as a job sharing its caller's group deadlocks. *(Needs: testing, version)*

On Dependabot's pull requests it requests a review through `review.yml`. When another pipeline in the same run already does (two pipelines in one repository, say), pass `review_dependabot: false` to one of them so the request isn't made twice.

| Input | Default | Description |
| :--- | :--- | :--- |
| `ref` | `''` | Commit, branch or tag to check, build and deploy; empty means the commit that triggered the run |
| `setup_go` | `''` | Go to install before `pre_build_command`: a version, e.g. `1.25.x`, or a `go.mod`, `go.work`, `.go-version` or `.tool-versions` path from the repository root; empty installs none |
| `pre_build_command` | `''` | Shell command run in `working_directory` before `npm ci`, in every job that installs the site |
| `review_dependabot` | `true` | Request a review on Dependabot's pull requests |
| `base_path` | `''` | The path the site is served under, e.g. `/my-repo/` for a project site; the site checks need it to resolve root-relative links. Empty means `/` |
| `check_links` | `false` | Check the built site's links with lychee |
| `check_external_links` | `false` | With `check_links`, check links to other sites too |
| `link_check_args` | `''` | Extra lychee arguments, e.g. `--include-fragments` or `--exclude <pattern>` |
| `check_accessibility` | `false` | Check the built site against WCAG 2.2 A and AA with axe |
| `accessibility_paths` | `''` | Comma- or newline-separated pages to check, relative to `base_path`; empty checks every page in the sitemap, else the home page |
| `accessibility_impact` | `'serious'` | The lowest axe impact that fails the check: `minor`, `moderate`, `serious` or `critical` |

It also takes one optional secret, `GH_TOKEN`, for `pre_build_command`.

### Building another commit

By default every job checks out the commit that triggered the run. Set `ref` to a branch, tag or commit to check, build and deploy that instead, for example the tip of `main` after an earlier job in the same run pushed a commit to it:

```yaml
jobs:
  generate:
    # ...commits generated files and pushes them to main
  website:
    needs: generate
    uses: apollogeddon/forgejs/.github/workflows/website.yml@main
    with:
      ref: main
```

`testing.yml`'s `patch` job still checks out the triggering commit, so on `main` it can only push its patches when nothing else has pushed since.

### Generating content before the build

A site that builds from files something else makes first, such as reference pages a Go tool writes or a file copied from elsewhere in the repository, sets `pre_build_command`. It runs with `bash -e` in `working_directory`, after Node.js (and Go, with `setup_go`) is set up and before `npm ci`, in the lint, test and build jobs, so the type check and tests see the same files the build does:

```yaml
jobs:
  website:
    uses: apollogeddon/forgejs/.github/workflows/website.yml@main
    with:
      working_directory: docs
      setup_go: go.mod
      pre_build_command: |
        go run ./cmd/gendocs --out src/content/reference
        cp ../CHANGELOG.md src/content/changelog.md
    secrets:
      GH_TOKEN: ${{ secrets.DOCS_TOKEN }}
```

The command gets a token, as `GH_TOKEN`, only when the caller passes the `GH_TOKEN` secret; `gh` and most Go tooling read it from there. To give it the run's own token, pass `GH_TOKEN: ${{ github.token }}`; it has the permissions of the calling job. The checkout keeps no credentials, so `git` can't push with it either way.

### Site checks

Two checks of the built site are off by default, as a check that suddenly fails would break the existing sites calling `website.yml`. Turn them on with `check_links` and `check_accessibility`. They run in `testing.yml`'s `build` job after the build artifact is uploaded, so a failing check stops the deploy but leaves the build to inspect. Each writes its findings to the run's summary.

Both serve the site from a copy at `base_path`, as GitHub Pages does, so set `base_path` to the site's base (`/<repo>/` for a project site, unless it uses a custom domain). Leave it empty for a site built with relative URLs, such as `init --website`'s Vite config.

- **Links**: [lychee](https://lychee.cli.rs/) checks every link in the built HTML. By default it only checks links within the site, offline, so another site being down never fails a build; set `check_external_links` to check those too. A directory link needs an `index.html`, and a link without an extension also matches `<path>.html`. lychee reads a `lychee.toml` or `.lycheeignore` in `working_directory`, and `link_check_args` passes it anything else.
- **Accessibility**: [axe](https://github.com/dequelabs/axe-core) checks each page in a headless Chromium against WCAG 2.0, 2.1 and 2.2 A and AA. It checks `accessibility_paths`, else every page in `sitemap-index.xml` or `sitemap.xml`, else the home page. Violations at `accessibility_impact` or above fail the check and are annotated on the run; lower ones are reported as warnings. The job installs Chromium and, with passwordless `sudo`, the libraries it needs; a self-hosted runner without `sudo` needs those libraries installed already.

```yaml
jobs:
  website:
    uses: apollogeddon/forgejs/.github/workflows/website.yml@main
    with:
      base_path: /my-site/
      check_links: true
      check_accessibility: true
      accessibility_paths: |
        /
        /docs/
```

`website.yml` was a deploy-only step before v3. Callers that ran `testing.yml` themselves and passed in a prebuilt artifact should now call `website.yml` alone.

## docker.yml

*Builds a Docker image for any number of platforms and publishes it to GitHub Container Registry.*

`init --docker` adds it to your `index.yml` as its own `docker` job after your pipeline job, so projects without Docker don't carry it. It builds on every run and pushes when the pipeline reports a new release. The job needs `packages: write` to push.

1. **`prepare`**: Resolves the image name (`ghcr.io/<owner>/<repo>`, lowercased) and turns `platforms` into a build matrix.
2. **`build`**: Builds each platform on its own runner. `linux/amd64` and `linux/arm64` build natively (`ubuntu-24.04-arm`); every other platform is emulated with QEMU. On pull requests the image is built but not pushed, so a broken Dockerfile fails the PR's checks. Make the `docker` job a required status check to stop Dependabot auto-merge on a failing build.
3. **`merge`**: When `push` is `true`, combines the per-platform images into one multi-platform manifest tagged `X.Y.Z`, `X.Y`, `X` (omitted for `0.x` versions), `sha-<commit>` and `latest`, with provenance and SBOM attestations. *(Needs: build)*

Images carry their provenance (`mode=max`) and SBOM as BuildKit attestations in the image index itself, so they need no `attest.yml` job; `docker buildx imagetools inspect <image> --format '{{ json .Provenance }}'` shows them.

With `buildkit_endpoint` set, **`build-remote`** replaces `build` and `merge`: one job on `runs_on` builds every platform on that BuildKit, emulating the ones its host can't run natively, and on a release pushes the same tags and attestations itself. The BuildKit host needs QEMU registered for foreign platforms (`binfmt_misc`), and its emulated builds run several times slower than native ones. Pushed images build without the cache, as a shared BuildKit's cache could hold layers another repository's job planted.

| Input | Default | Purpose |
| :--- | :--- | :--- |
| `push` | `false` | Push to GHCR; the generated job sets it for a new release on `main` |
| `version` | `''` | Release version used for the semver tags |
| `image` | `ghcr.io/<owner>/<repo>` | Image name override |
| `platforms` | `linux/amd64,linux/arm64` | Comma-separated platforms, e.g. `linux/amd64,linux/arm64,linux/arm/v7` |
| `native_arm` | `true` | Build arm64 on native Arm runners; set `false` to emulate (e.g. if Arm runners aren't available to a private repo) |
| `buildkit_endpoint` | `''` | A remote BuildKit, e.g. `tcp://runner.builder:1234`, to build every platform in one job on `runs_on` |

The generated Dockerfiles build platform-independent work once on the build host and only the platform-specific parts per target. Supported platforms follow the base images:

| Image | Platforms |
| :--- | :--- |
| Backend (`node:24-slim`, running as the non-root `node` user) | `linux/amd64`, `linux/arm64`, `linux/arm/v7`, `linux/ppc64le` |
| Website (`nginx:stable-alpine`) | `linux/amd64`, `linux/arm64`, `linux/arm/v6`, `linux/arm/v7`, `linux/386`, `linux/ppc64le`, `linux/riscv64`, `linux/s390x` |

Building locally needs a token with `read:packages` so `npm ci` can install `@apollogeddon` packages: `NODE_AUTH_TOKEN=<token> npm run docker:build`. Podman's Windows client can't pass build secrets, so on Windows with Podman run the build from inside the Podman machine or WSL.
