---
title: Configuration
description: How the generated configs extend the Forge.js base configs, and how to override them.
---

This page explains how the config files `init` generates relate to the base configs in `@apollogeddon/forgejs`, and where to put project-specific settings.

Forge.js uses layered configuration: each tool's project-level config extends a base config shipped in the package, so you override only what your project needs.

## Shared configs

The base configs are published through the package's `exports`, and `init` adds `@apollogeddon/forgejs` as a `devDependency` so they resolve after `npm install`.

| Base config | Extended by |
| :--- | :--- |
| `node_modules/@apollogeddon/forgejs/configs/biome.json` | `biome.json` |
| `@apollogeddon/forgejs/configs/tsconfig.json` | `tsconfig.json` |
| `@apollogeddon/forgejs/vitest.config.cjs` | `vitest.config.ts` |
| `@apollogeddon/forgejs/tsdown.config.cjs` | `tsdown.config.ts` |
| `@apollogeddon/forgejs/commitlint.config.cjs` | `commitlint.config.ts` |

Biome resolves `extends` as a file path, so `biome.json` references the copy in `node_modules`. The others use the package's `exports`.

Upgrading `@apollogeddon/forgejs` updates every base config at once, with no files to refresh.

## Quality and testing

### Biome: linting and formatting

The generated `biome.json` extends the shared config:

```json
{
  "$schema": "node_modules/@biomejs/biome/configuration_schema.json",
  "extends": ["node_modules/@apollogeddon/forgejs/configs/biome.json"]
}
```

Add project-specific settings alongside `extends`; they take precedence over the base.

### TypeScript

The generated `tsconfig.json` extends the shared TypeScript config, so every project compiles with the same strictness settings. Add `compilerOptions` to override individual settings.

### Vitest: testing

The generated `vitest.config.ts` merges the base configuration:

```ts
import baseConfig from "@apollogeddon/forgejs/vitest.config.cjs";
import { mergeConfig } from "vitest/config";

export default mergeConfig(baseConfig, {
  test: {
    // Project-specific overrides
  },
});
```

### Lefthook: Git hooks

`lefthook.yml` runs Biome and Publint before each commit, and commitlint on each commit message:

| Hook | Stage |
| :--- | :--- |
| `biome check` on staged files | pre-commit |
| `publint` | pre-commit |
| `commitlint --edit` | commit-msg, only with versioning on |

Lefthook installs the hooks through the `prepare` script when you run `npm install`. To customise them, edit `lefthook.yml`.

### commitlint: commit messages

With versioning on, the generated `commitlint.config.ts` extends the shared Conventional Commits configuration:

```ts
import baseConfig from '@apollogeddon/forgejs/commitlint.config.cjs';
import type { UserConfig } from '@commitlint/types';

const Configuration: UserConfig = {
  extends: baseConfig.extends,
  // Add project-specific rules here
};

export default Configuration;
```

## Build and release

### tsdown: TypeScript bundler

Backends and libraries bundle with tsdown. The base config builds `src/index.ts` to ESM for Node.js 22, with type declarations and source maps, keeping the `.js` and `.d.ts` extensions that `main`, `types` and `bin` point to. The generated `tsdown.config.ts` spreads it:

```ts
import baseConfig from "@apollogeddon/forgejs/tsdown.config.cjs";
import { defineConfig } from "tsdown";

export default defineConfig({
  ...baseConfig,
});
```

### Vite: websites

`--website` generates a `vite.config.ts` that builds to `dist/`, the directory the website workflow deploys to GitHub Pages. It sets `base: "./"` so asset URLs are relative and the site works under a GitHub Pages project path (`https://<owner>.github.io/<repo>/`).

### release-please: versioning

The reusable `version.yml` workflow runs release-please with the `node` release type. It needs no local config file: version numbers and changelogs come from your Conventional Commits.

To set release-please options, add a config and manifest to the project's `.github` directory (under `working_directory`, if set). `version.yml` then runs release-please from them instead of the `node` defaults. The config keys the package by its path from the repository root, `.` for a project at the root:

```json title=".github/release.json"
{
  "packages": {
    ".": {
      "release-type": "node",
      "include-component-in-tag": false
    }
  }
}
```

```json title=".github/.release.json"
{
  ".": "1.4.2"
}
```

Set the manifest to the current released version. See release-please's [config options](https://github.com/googleapis/release-please/blob/main/docs/manifest-releaser.md) for the rest.

### Docker

`--docker` adds a multi-stage `Dockerfile`:

- **Backend:** compiles once on the build host, installs production dependencies per target platform, and runs `node dist/index.js` on `node:22-slim` as the non-root `node` user.
- **Website:** builds the static site once on the build host and serves it with `nginx:stable-alpine` on port 80.

CI builds the image for every configured platform. See [docker.yml](/forgejs/docs/workflows/reference#dockeryml) in the job reference.

### Snodeb: Debian packaging

`--debian` generates a `snodeb.config.cjs` (CommonJS, as Snodeb requires). Edit it to suit your service; this is the generated default:

```js
const { defineSnodebConfig } = require("snodeb");
// a package.json without a name falls back to the project directory's name
const { name = require("node:path").basename(__dirname) } = require("./package.json");

// The service runs as its own system user, which the package's postinst creates, never as root.
// It's named after the package without its scope, as a Debian user name can't hold '@', '/' or '.'.
const unscoped = name
  .split("/")
  .pop()
  .toLowerCase()
  .replace(/[^a-z0-9_-]/g, "-");
const user = (/^[a-z_]/.test(unscoped) ? unscoped : `svc-${unscoped}`).slice(0, 32);

module.exports = defineSnodebConfig({
  architecture: "all",
  depends: ["nodejs"],
  files: {
    include: ["dist/index.js", "node_modules/**/*"],
    configInclude: [".env", "config/default.json"],
    prune: true,
    unPrune: false,
  },
  systemd: {
    user,
    group: user,
    entryPoint: "dist/index.js",
  },
});
```

The service never runs as root. It runs as a system user that the package's `postinst` creates with no home directory or login shell. The user is named after the package without its scope, or after the project directory when `package.json` has no `name`. The installed files stay owned by root, so the service can read its code and `.env` but not change them; give it a directory under `/var/lib` if it needs to write.

## Repository files

`init` also writes three files for the repository itself. Like the configs, an existing file is kept unless you pass `--force`.

| File | What it does |
| :--- | :--- |
| `.editorconfig` | LF line endings, UTF-8, 2-space indent and 120 columns, matching the Biome config |
| `.github/dependabot.yml` | Weekly npm and GitHub Actions updates, plus Docker with `--docker`. Minor and patch updates are grouped into one pull request, and each update waits 3 days after it's published before it's proposed, so a compromised release has time to be caught upstream. The workflow's auto-merge job merges them once CI passes. |
| `.github/CODEOWNERS` | `* @owner`, so every pull request someone else opens, Dependabot's and release-please's included, requests your review and shows in your review requests. It doesn't block merging. |

In a private repository, Dependabot can't read `@apollogeddon/forgejs`, or your own packages, from GitHub Packages without a token, and its npm updates fail with `private_source_authentication_failure`. Add a classic token with only `read:packages` as a Dependabot secret named `PACKAGES_TOKEN` (**Settings → Secrets and variables → Dependabot**), then give the npm update the registry:

```yaml
registries:
  npm-github:
    type: npm-registry
    url: https://npm.pkg.github.com
    # Without a committed .npmrc, Dependabot needs the scope this registry serves.
    scope: "@apollogeddon"
    token: ${{ secrets.PACKAGES_TOKEN }}

updates:
  - package-ecosystem: "npm"
    registries:
      - npm-github
    # ...the rest of the generated entry
```

`init` leaves this out, as a public repository needs no token and Dependabot fails on a secret that doesn't exist.

The `CODEOWNERS` owner is the GitHub account in `package.json`'s `repository` field or, failing that, the `origin` remote. A project with neither gets no `CODEOWNERS`; run `init` again once it has a GitHub remote.
