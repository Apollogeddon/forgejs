---
title: Pipeline reference
description: Stage-by-stage breakdown of each reusable pipeline, and its inputs.
---

This page describes each pipeline's stages and the inputs it takes. For the generated `.index.yml`, when each pipeline runs and the permissions they need, see the [workflows overview](/forgejs/docs/workflows/overview).

## Choosing runners

Every pipeline takes a `runs_on` input, default `ubuntu-latest`, for each of its jobs. To use self-hosted runners, set it per repository, for example from a repository variable: `runs_on: ${{ vars.RUNS_ON || 'ubuntu-latest' }}`.

`docker.yml`'s builds and its push use GitHub-hosted runners: the arm64 build because it needs a native Arm machine, and the others because they need a Docker daemon. With `buildkit_endpoint` set, it builds every platform in one job on `runs_on` instead, against a remote BuildKit, so self-hosted runners without a Docker daemon can build and push multi-platform images.

## Check pipelines: library.yml, service.yml, website.yml

*Lint, scan, test and build.*

The three share their first four stages, job for job:

1. **`lint`**: `npm ci`, then `biome ci` (skipped without a `biome.json`) and `npm run type`.
2. **`scan`**: Gitleaks secret scan (skip with `enable_secrets: false`) and an OSV-Scanner dependency scan. On a pull request, a high or critical finding (a CVSS score of 7 or more, or GitHub's rating when an advisory has no score) fails the stage, so a change can't add one. Elsewhere, such as on a release, it's an error annotation that doesn't fail it: an advisory published against a dependency you already have shouldn't stop releases, and the weekly `patch` pipeline can update it. Lower findings are warning annotations, and every finding is listed in the job summary. The stage installs a pinned OSV-Scanner release and checks it against the checksums published with it, failing if either download or the check fails. If the scanner can't finish, for example because OSV's API is unreachable, the stage fails a pull request, which mustn't merge unchecked, and elsewhere warns and passes. To accept a finding you can't fix yet, list it in an [`osv-scanner.toml`](https://google.github.io/osv-scanner/configuration/) beside the lockfile:

   ```toml
   [[IgnoredVulns]]
   id = "GHSA-xxxx-xxxx-xxxx"
   ignoreUntil = 2026-12-31
   reason = "No fixed version yet; the vulnerable function isn't called"
   ```

3. **`test`**: The test suite (skip with `run_tests: false`), with the coverage report uploaded as `coverage-<artifact_name>`. *(Needs: lint, scan)*
4. **`build`**: Writes `build_env_vars` to `.env`, runs the build, then the project's `publint` and `docs:check` scripts when it defines them, and uploads `dist/` as the `artifact_name` artifact. *(Needs: lint, scan; runs alongside test)*

`website.yml` adds:

5. **`check`**: With `check_links` or `check_accessibility`, checks the uploaded build; see [Site checks](#site-checks). *(Needs: build)*

| Input | Default | Description |
| :--- | :--- | :--- |
| `runs_on` | `'ubuntu-latest'` | Runner label for every job |
| `working_directory` | `'.'` | Directory holding `package.json`, relative to the repository root without a leading `./` |
| `node_version` | `''` | Node.js version for every job. Empty reads the project's `.nvmrc`, and without one uses forgejs's default; see [Node.js version](/forgejs/docs/configuration#nodejs-version) |
| `enable_secrets` | `true` | Run the Gitleaks secret scan |
| `run_tests` | `true` | Run the test stage; `init --no-testing` sets it to `false` |
| `build_env_vars` | `''` | Lines written to `.env` before the build |
| `artifact_name` | `'dist'` | Name of the build artifact, which `publish`, `debian` and `pages` download |
| `ref` | `''` | Commit, branch or tag to check and build; empty means the commit that triggered the run |
| `setup_go` | `''` | Go to install before `pre_build_command`: a version, e.g. `stable`, or a `go.mod`, `go.work`, `.go-version` or `.tool-versions` path from the repository root; empty installs none |
| `pre_build_command` | `''` | Shell command run in `working_directory` before `npm ci`, in every stage that installs |

`website.yml` also takes:

| Input | Default | Description |
| :--- | :--- | :--- |
| `base_path` | `''` | The path the site is served under, e.g. `/my-repo/` for a project site; the site checks need it to resolve root-relative links. Empty means `/` |
| `check_links` | `false` | Check the built site's links with lychee |
| `check_external_links` | `false` | With `check_links`, check links to other sites too |
| `link_check_args` | `''` | Extra lychee arguments, e.g. `--include-fragments` or `--exclude <pattern>` |
| `check_accessibility` | `false` | Check the built site against WCAG 2.2 A and AA with axe |
| `accessibility_paths` | `''` | Comma- or newline-separated pages to check, relative to `base_path`; empty checks every page in the sitemap, else the home page |
| `accessibility_impact` | `'serious'` | The lowest axe impact that fails the check: `minor`, `moderate`, `serious` or `critical` |

Each takes one optional secret, `GH_TOKEN`, for `pre_build_command`.

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

`library.yml` and `service.yml` take `ref` too.

### Generating content before the build

A site that builds from files something else makes first, such as reference pages a Go tool writes or a file copied from elsewhere in the repository, sets `pre_build_command`. It runs with `bash -e` in `working_directory`, after Node.js (and Go, with `setup_go`) is set up and before `npm ci`, in the lint, test and build stages, so the type check and tests see the same files the build does:

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

Two checks of the built site are off by default, as a check that suddenly fails would break the existing sites calling `website.yml`. Turn them on with `check_links` and `check_accessibility`. They run in the `check` stage, on the build artifact the `build` stage uploaded, so a failing check stops the deploy but leaves the build to inspect. Each writes its findings to the run's summary.

Both serve the site from a copy at `base_path`, as GitHub Pages does, so set `base_path` to the site's base (`/<repo>/` for a project site, unless it uses a custom domain). Leave it empty for a site built with relative URLs, such as `init --website`'s Vite config.

- **Links**: [lychee](https://lychee.cli.rs/) checks every link in the built HTML. By default it only checks links within the site, offline, so another site being down never fails a build; set `check_external_links` to check those too. A directory link needs an `index.html`, and a link without an extension also matches `<path>.html`. lychee reads a `lychee.toml` or `.lycheeignore` in `working_directory`, and `link_check_args` passes it anything else.
- **Accessibility**: [axe](https://github.com/dequelabs/axe-core) checks each page in a headless Chromium against WCAG 2.0, 2.1 and 2.2 A and AA. It checks `accessibility_paths`, else every page in `sitemap-index.xml` or `sitemap.xml`, else the home page. Violations at `accessibility_impact` or above fail the check and are annotated on the run; lower ones are reported as warnings. The stage installs Chromium and, with passwordless `sudo`, the libraries it needs; a self-hosted runner without `sudo` needs those libraries installed already.

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

## version.yml

*release-please.*

1. **`release`**: On `main`, opens or updates the release pull request from Conventional Commits, and creates the tag and GitHub release when it merges. A `working_directory` other than `.` becomes release-please's `path`, so a package in a monorepo is versioned on its own, tagged with its `package.json` name (`api-vX.Y.Z`). If the project has a `.github/release.json` and `.github/.release.json` under `working_directory`, release-please runs from them instead (see [release-please: versioning](/forgejs/docs/configuration#release-please-versioning)). The stage checks out only that `.github` directory to look for them. When it opened or updated a release pull request, it requests a review on it from `reviewers`, as `merge.yml` does on Dependabot's.

Outputs `new_release_published` (`'true'` or `'false'`), `version` and `tag_name`: those of the `working_directory` package, not of any other package released in the same run.

| Input | Default | Description |
| :--- | :--- | :--- |
| `working_directory` | `'.'` | The package to release |
| `node_version` | `''` | Node.js version; empty reads the project's `.nvmrc`, else forgejs's default |
| `reviewers` | `''` | Comma-separated logins to request a review of the release pull request from; empty means the repository's owner |

### Checking a release

A push to `main` runs `version` first, and only when it makes a release does `.index.yml` run the checks again, and then the publish, image push or deploy that ships what they built. So each change is checked on its pull request and once more as part of a release, not on every push.

release-please tags the release before those checks run. If they fail, the tag and the GitHub release exist with nothing published, and need putting right by hand. The generated `.index.yml` therefore checks release pull requests too, so the release is checked with exactly what its merge ships. release-please opens them with `GITHUB_TOKEN`, which doesn't start workflow runs, so approve the run (or push to the branch) before merging one.

With **Require branches to be up to date before merging** turned on, every pull request is checked again before it merges; skipped jobs count as passed for required status checks.

## publish.yml

*Ships a release.*

1. **`package`**: With `package` (on by default), downloads the build artifact, packs it and publishes the tarball to GitHub Packages as is, using `GITHUB_TOKEN`. Nothing is installed and lifecycle scripts (`prepublishOnly`, `prepare`) don't run, so no dependency code runs while the publish token is set; run those checks in your build or tests instead. It then uploads the published tarball as the `<artifact_name>-package` artifact.
2. **`assets`**: With `assets` set to an artifact's name, attaches its files to the GitHub release `tag_name` names, replacing any of the same name. The generated `--debian` workflow attaches the `.deb` this way.
3. **`attest`**: With `attest`, attests the build provenance of the published tarball and the attached files with [`actions/attest-build-provenance`](https://github.com/actions/attest-build-provenance): a signed statement, kept by GitHub, of the repository, commit and workflow run that built them. *(Needs: package, assets)*

npm's own `--provenance` flag only works with the public npm registry, which GitHub Packages isn't, so a library attests the tarball it published instead. Artifact attestations are free in public repositories; a private repository needs GitHub Enterprise Cloud, so `attest` is off by default. The generated library `publish` job turns it on only when the repository is public, and grants the two extra permissions it needs:

```yaml
  publish:
    # ...as generated
    with:
      attest: ${{ github.event.repository.private == false }}
    permissions:
      contents: read
      packages: write
      id-token: write
      attestations: write
```

GitHub checks a called workflow's permissions before running any of it, so a caller grants the union of what its jobs ask for, even those turned off. `package`, which holds the publish token, asks for exactly `contents: read` and `packages: write`, so it never gets the signing permissions. `assets` and `attest` ask for none, as asking would stop every caller that doesn't grant them, and take the caller's grant instead.

To check a published package, fetch its tarball and verify it against your repository. The attestation is signed by `publish.yml`, so name forgejs as the signer:

```bash
npm pack @<owner>/<name>@<version>
gh attestation verify <owner>-<name>-<version>.tgz --repo <owner>/<repo> --signer-repo apollogeddon/forgejs
```

A package published to the public npm registry from your own workflow can use `npm publish --provenance` instead, which needs `id-token: write` too.

Outputs `published` (`'true'` when this run published the package) and `package_artifact` (the name of the artifact holding the published tarball).

| Input | Default | Description |
| :--- | :--- | :--- |
| `working_directory` | `'.'` | Directory holding `package.json` |
| `node_version` | `''` | Node.js version; empty reads the project's `.nvmrc`, else forgejs's default |
| `artifact_name` | `'dist'` | The build artifact to pack |
| `package` | `true` | Publish to GitHub Packages; needs `packages: write` |
| `assets` | `''` | An artifact whose files to attach to the release; needs `contents: write` |
| `tag_name` | `''` | The release to attach them to, as `version.yml`'s `tag_name` |
| `attest` | `false` | Attest what the other stages shipped; needs `id-token: write` and `attestations: write` |

## pages.yml

*GitHub Pages.*

1. **`deploy`**: Downloads the `artifact_name` build artifact, which `website.yml` uploaded earlier in the run, and deploys it to GitHub Pages. Deploys run one at a time, in the `pages-deploy` concurrency group: a newer deploy waits for a running one, and replaces one still waiting. The group isn't `pages`, the one GitHub's starter Pages workflow uses at workflow level, as a job sharing its caller's group deadlocks.

`init --website` calls it on a release, or on every push to `main` without versioning, when the repository is public: GitHub Pages on a free plan serves only public repositories. On a paid plan, drop `github.event.repository.private == false` from the generated `pages` job's condition to deploy a private one. It deploys whatever `npm run build` writes to `dist/`.

| Input | Default | Description |
| :--- | :--- | :--- |
| `artifact_name` | `'dist'` | The build artifact to deploy |

## debian.yml

*Debian packaging.*

1. **`build`**: Downloads the build artifact `service.yml` uploaded, installs the dependencies (without a cache, as a poisoned one would be packaged), packages it with Snodeb (copying `.env.production` to `.env` if present), and uploads the `.deb` as the `debian-package` artifact.
2. **`test`**: Reads the `.deb` back with `dpkg-deb`: its control fields and file list, so a broken package fails before it ships. *(Needs: build)*

`init --debian` runs it on pull requests and on a release, and on a release attaches the `.deb` to the GitHub release through `publish.yml`'s `assets`.

Outputs `package_artifact`, the name of the artifact holding the `.deb` (`debian-package`), for `publish.yml`'s `assets`.

| Input | Default | Description |
| :--- | :--- | :--- |
| `working_directory` | `'.'` | Directory holding `package.json` |
| `node_version` | `''` | Node.js version; empty reads the project's `.nvmrc`, else forgejs's default |
| `artifact_name` | `'dist'` | The build artifact `service.yml` uploaded |

## docker.yml

*Builds a Docker image for any number of platforms and publishes it to GitHub Container Registry.*

`init --docker` adds it to `.index.yml` as its own `docker` job after the checks, so projects without Docker don't carry it. It builds on pull requests, so a broken Dockerfile fails the PR's checks and stops a Dependabot merge, and builds and pushes on a release.

1. **`build`**: Builds every platform but a native arm64 one, in one build: `linux/amd64` natively and every other platform with QEMU. When `push` is `true`, it pushes them untagged, by digest.
2. **`build (arm64)`**: With `native_arm` (on by default) and `linux/arm64` in `platforms`, builds arm64 on GitHub's native Arm runner, and pushes it by digest the same way.
3. **`push`**: When `push` is `true`, combines what the builds pushed into one multi-platform manifest tagged `X.Y.Z`, `X.Y`, `X` (omitted for `0.x` versions), `sha-<commit>` and `latest`. *(Needs: build, build (arm64))*

Images carry their provenance (`mode=max`) and SBOM as BuildKit attestations in the image index itself, so they need no `attest` stage; `docker buildx imagetools inspect <image> --format '{{ json .Provenance }}'` shows them.

With `buildkit_endpoint` set, `build` runs on `runs_on` and builds every platform on that BuildKit, emulating the ones its host can't run natively, and on a release pushes the same tags and attestations itself, so `build (arm64)` and `push` are skipped. The BuildKit host needs QEMU registered for foreign platforms (`binfmt_misc`), and its emulated builds run several times slower than native ones. Pushed images build without the cache, as a shared BuildKit's cache could hold layers another repository's job planted.

| Input | Default | Purpose |
| :--- | :--- | :--- |
| `push` | `false` | Push to GHCR; the generated job sets it for a release |
| `version` | `''` | Release version used for the semver tags |
| `image` | `ghcr.io/<owner>/<repo>` | Image name override |
| `platforms` | `linux/amd64,linux/arm64` | Comma-separated platforms, e.g. `linux/amd64,linux/arm64,linux/arm/v7` |
| `native_arm` | `true` | Build arm64 on a native Arm runner; set `false` to emulate (e.g. if Arm runners aren't available to a private repo) |
| `buildkit_endpoint` | `''` | A remote BuildKit, e.g. `tcp://runner.builder:1234`, to build every platform in one job on `runs_on` |
| `working_directory` | `'.'` | Directory holding the Dockerfile |

The generated Dockerfiles build platform-independent work once on the build host and only the platform-specific parts per target. Supported platforms follow the base images:

| Image | Platforms |
| :--- | :--- |
| Backend (`node:<version>-slim`, running as the non-root `node` user) | `linux/amd64`, `linux/arm64`, `linux/arm/v7`, `linux/ppc64le` |
| Website (`nginx:stable-alpine`) | `linux/amd64`, `linux/arm64`, `linux/arm/v6`, `linux/arm/v7`, `linux/386`, `linux/ppc64le`, `linux/riscv64`, `linux/s390x` |

Building locally needs a token with `read:packages` so `npm ci` can install `@apollogeddon` packages: `NODE_AUTH_TOKEN=<token> npm run docker:build`. Podman's Windows client can't pass build secrets, so on Windows with Podman run the build from inside the Podman machine or WSL.

## patch.yml

*Security patches: weekly, on a manual run, and after a Dependabot merge.*

1. **`update`**: On `main`, runs `osv-scanner fix` against `package-lock.json` in `working_directory`, then `npm install`, and commits any changes as `fix(deps): patch vulnerabilities via osv-scanner`. It checks out the tip of `main`, so a second call in the same run (forgejs patches its docs site after the tool) commits on top of the first.

The commit is made with `GITHUB_TOKEN`, so it starts no run of its own: release-please picks it up on the next push to `main`.

| Input | Default | Description |
| :--- | :--- | :--- |
| `working_directory` | `'.'` | Directory holding `package.json` and `package-lock.json` |
| `node_version` | `''` | Node.js version; empty reads the project's `.nvmrc`, else forgejs's default |

## merge.yml

*Dependabot's pull requests.*

1. **`review`**: Requests a review from `reviewers`, or from the repository's owner when `reviewers` is empty and the owner is a user (an organisation names its reviewers through the input). GitHub only requests code owners' reviews in a private repository on a paid plan, so without this, Dependabot's pull requests in a private repository on GitHub Free never reach your review requests. It runs whether the checks passed or not, so a failing update reaches you too. A failed request logs a warning and never fails the run.
2. **`squash`**: When `checks_passed` is `true`, and Dependabot both opened the pull request and made its latest change (someone else's push to its branch waits for a person), enables GitHub's auto-merge so the PR merges once required checks pass, or merges it straight away when it can already be merged. It squash-merges, so release-please lists each update once: a merge commit repeats the pull request's title, and release-please reads that as a second change. Merge your own pull requests the same way, with **Squash and merge**. GitHub Actions updates (branches starting `dependabot/github_actions/`) are left for a person to merge: they change workflow files, which `GITHUB_TOKEN` can't merge. Once the pull request has merged, it sends the `auto-merged` `repository_dispatch` event, so `.index.yml` runs on `main`: a merge made with `GITHUB_TOKEN` starts no push run. When it enabled auto-merge rather than merging, it waits up to 12 minutes for the merge before sending it. See [Secrets](/forgejs/docs/workflows/overview#secrets).

The generated `merge` job passes `checks_passed` as whether every check job before it passed.

| Input | Default | Description |
| :--- | :--- | :--- |
| `reviewers` | `''` | Comma-separated logins to request a review from; empty means the repository's owner |
| `checks_passed` | `false` | Whether the pull request's checks passed in this run; `squash` only runs when they did |
