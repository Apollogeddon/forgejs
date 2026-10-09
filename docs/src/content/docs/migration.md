---
title: Migrating to Forge.js
description: Remove conflicting tooling and adopt the Forge.js standard configurations.
---

This guide is for existing projects moving to Forge.js from ESLint, Prettier, Jest or semantic-release. Forge.js replaces those tools, so remove their configuration to avoid conflicts.

## Migration checklist

### 1. Run init

Generate the standard configurations. See [Getting started](/forgejs/docs/getting-started) for the install steps and mode flags.

```bash
npx @apollogeddon/forgejs init
```

`init` keeps existing scripts with the same names as its own, such as `lint` or `test`. Pass `--force` to replace them with the Forge.js versions.

### 2. Remove old configs

Remove the configuration files of the tools Forge.js replaces:

```bash
# ESLint and Prettier
rm -f .eslintrc* eslint.config.* .prettierrc* .eslintignore .prettierignore

# Jest
rm -f jest.config.*

# semantic-release, if you used it
rm -f .releaserc*
```

### 3. Remove old dependencies

Uninstall the tools Forge.js now manages:

```bash
npm uninstall eslint prettier jest ts-jest
```

### 4. Fix linting errors

Biome's recommended rules can be stricter than your previous ESLint setup. Apply the automatic fixes, then fix the rest by hand:

```bash
npm run lint
```

## Tool-specific notes

### ESLint and Prettier to Biome

Biome handles both linting and formatting. The generated `biome.json` extends the shared config, so you usually need no further configuration.

The pre-commit hook only checks staged files, but CI checks the whole project. On a large codebase, fix the existing errors in one pass before relying on CI.

### Jest to Vitest

Vitest is largely API-compatible with Jest, with these differences:

1. **Globals:** Vitest doesn't provide test globals by default, and the shared config keeps it that way. Import `describe`, `it`, `expect` and the rest from `vitest` in each test file:

   ```ts
   import { describe, it, expect } from 'vitest';
   ```

2. **Environment:** The shared config uses the `node` environment. For tests that need a DOM, install `happy-dom` or `jsdom` and set `test.environment` in `vitest.config.ts`.

### semantic-release to release-please

Forge.js versions releases with release-please, through the reusable `version.yml` workflow. Release configuration lives in the workflow, so the project needs no local config file.
