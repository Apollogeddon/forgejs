---
title: Configuration
description: Extend Forge.js tool configurations for project-specific overrides.
---

Forge.js uses a layered configuration model: each tool's project-level config extends a base config shipped inside the `@apollogeddon/forgejs` package, so you override only what your project needs.

## Shared Configs

The base configs are published through the package's `exports`, and `init` adds `@apollogeddon/forgejs` as a `devDependency` so they resolve after `npm install`.

| Base config | Extended by |
| :--- | :--- |
| `@apollogeddon/forgejs/configs/biome.json` | `biome.json` |
| `@apollogeddon/forgejs/configs/tsconfig.json` | `tsconfig.json` |
| `@apollogeddon/forgejs/vitest.config.cjs` | `vitest.config.ts` |
| `@apollogeddon/forgejs/tsup.config.cjs` | `tsup.config.ts` |
| `@apollogeddon/forgejs/commitlint.config.cjs` | `commitlint.config.ts` |

Upgrading `@apollogeddon/forgejs` updates every base config at once — no files to refresh.

## Quality & Testing

### Biome — Linting & Formatting

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

### Vitest — Testing

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

### Lefthook — Git Hooks

`lefthook.yml` runs Biome and Publint before each commit, and commitlint on the commit message:

| Hook | Stage |
| :--- | :--- |
| `biome check` on staged files | pre-commit |
| `publint` | pre-commit |
| `commitlint --edit` | commit-msg — only with versioning on |

Lefthook installs itself through the `prepare` script on `npm install`. To customise hooks, edit `lefthook.yml` directly.

### Commitlint — Commit Messages

With versioning on, the generated `commitlint.config.ts` extends the shared Conventional Commits configuration:

```ts
import baseConfig from "@apollogeddon/forgejs/commitlint.config.cjs";
import type { UserConfig } from "@commitlint/types";

const Configuration: UserConfig = {
  extends: baseConfig.extends,
  // Add project-specific rules here
};

export default Configuration;
```

## Build & Release

### Tsup — TypeScript Bundler

Backends and libraries bundle with Tsup. The generated `tsup.config.ts` spreads the base configuration:

```ts
import baseConfig from "@apollogeddon/forgejs/tsup.config.cjs";
import { defineConfig } from "tsup";

export default defineConfig({
  ...baseConfig,
});
```

### Vite — Websites

`--website` generates a `vite.config.ts` that builds to `dist/`, the directory the website workflow deploys to GitHub Pages. It sets `base: "./"` so asset URLs are relative and the site works under a GitHub Pages project path (`https://<owner>.github.io/<repo>/`).

### release-please — Versioning

Releases are driven by the reusable `version.yml` workflow using release-please with the `node` release type. No local config file is needed; version numbers and changelogs come from Conventional Commits.

### Docker

`--docker` adds a multi-stage `Dockerfile`:

- **Backend:** compiles once on the build host, installs production dependencies per target platform, and runs `node dist/index.js` on `node:22-slim` as the non-root `node` user.
- **Website:** builds the static site once on the build host and serves it with `nginx:stable-alpine` on port 80.

CI builds the image for every configured platform — see [Job Reference](/forgejs/docs/workflows/reference#dockeryml).

### Snodeb — Debian Packaging

`--debian` generates a `snodeb.config.cjs` (CommonJS, as Snodeb requires). Customise it after running `init --debian`:

```js
const { defineSnodebConfig } = require("snodeb");
const { name } = require("./package.json");

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

The service never runs as root. It runs as a system user named after the package (without its scope), which the package's `postinst` creates with no home directory or login shell. The installed files stay owned by root, so the service can read its code and `.env` but not change them; give it a directory under `/var/lib` if it needs to write.
