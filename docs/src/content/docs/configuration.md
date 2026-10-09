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
| `@apollogeddon/forgejs/tsup.config.cjs` | `tsup.config.ts` |
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

### Tsup: TypeScript bundler

Backends and libraries bundle with Tsup. The base config builds `src/index.ts` to ESM for Node.js 22, with type declarations and source maps. The generated `tsup.config.ts` spreads it:

```ts
import baseConfig from "@apollogeddon/forgejs/tsup.config.cjs";
import { defineConfig } from "tsup";

export default defineConfig({
  ...baseConfig,
});
```

### Vite: websites

`--website` generates a `vite.config.ts` that builds to `dist/`, the directory the website workflow deploys to GitHub Pages. It sets `base: "./"` so asset URLs are relative and the site works under a GitHub Pages project path (`https://<owner>.github.io/<repo>/`).

### release-please: versioning

The reusable `version.yml` workflow runs release-please with the `node` release type. It needs no local config file: version numbers and changelogs come from your Conventional Commits.

### Docker

`--docker` adds a multi-stage `Dockerfile`:

- **Backend:** compiles once on the build host, installs production dependencies per target platform, and runs `node dist/index.js` on `node:22-slim` as the non-root `node` user.
- **Website:** builds the static site once on the build host and serves it with `nginx:stable-alpine` on port 80.

CI builds the image for every configured platform. See [docker.yml](/forgejs/docs/workflows/reference#dockeryml) in the job reference.

### Snodeb: Debian packaging

`--debian` generates a `snodeb.config.cjs` (CommonJS, as Snodeb requires). Edit it to suit your service; this is the generated default:

```js
const { defineSnodebConfig } = require("snodeb");

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
    user: "root",
    group: "node-service",
    entryPoint: "dist/index.js",
  },
});
```
