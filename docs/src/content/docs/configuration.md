---
title: Configuration
description: Extend Forge.js tool configurations for project-specific overrides.
---

The package exports base configurations for standard tooling. Extend them to inherit best practices while allowing project-specific overrides.

## Quality & Testing

### Biome — Linting & Formatting

Extend the shared Biome configuration in `biome.json`:

```json
{
  "$schema": "node_modules/@biomejs/biome/configuration_schema.json",
  "extends": ["node_modules/@apollogeddon/forgejs/biome.json"]
}
```

### Vitest — Testing

Import and merge the base configuration in `vitest.config.ts`:

```ts
import baseConfig from '@apollogeddon/forgejs/vitest.config.cjs';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(baseConfig, {
  test: {
    // Project-specific overrides
  },
});
```

### Commitlint — Commit Message Linting

Extend the shared commitlint configuration in `commitlint.config.ts`:

```ts
import baseConfig from '@apollogeddon/forgejs/commitlint.config.cjs';
import type { UserConfig } from '@commitlint/types';

const Configuration: UserConfig = {
  extends: baseConfig.extends,
  // Add project-specific rules here
};

export default Configuration;
```

### Lefthook — Git Hooks

`lefthook.yml` is generated automatically by `init`. The default configuration runs Biome on staged files and commitlint on commit messages:

```yaml
pre-commit:
  parallel: true
  commands:
    biome-check:
      glob: "*.{js,ts,cjs,mjs,d.cts,d.mts,json,jsonc}"
      run: npx biome check --no-errors-on-unmatched --files-ignore-unknown=true {staged_files}
    publint:
      run: npx publint

commit-msg:
  parallel: true
  commands:
    commitlint:
      run: npx commitlint --edit {1}
```

To customise hooks, edit `lefthook.yml` directly after running `init`.

## Build & Release

### Tsup — TypeScript Bundler

Import the base configuration and override properties in `tsup.config.ts`:

```ts
import baseConfig from '@apollogeddon/forgejs/tsup.config.cjs';
import { defineConfig } from 'tsup';

export default defineConfig({
  ...baseConfig,
  // Override or add project-specific properties here
  entry: ['./src/index.ts'],
});
```

### Snodeb — Debian Packaging

The generated `snodeb.config.cjs` uses CommonJS format (required by snodeb). Customise it after running `init --debian`:

```js
const { defineSnodebConfig } = require('snodeb');

module.exports = defineSnodebConfig({
  architecture: 'all',
  depends: ['nodejs'],
  files: {
    include: ['dist/index.js', 'node_modules/**/*'],
    configInclude: ['.env', 'config/default.json'],
    prune: true,
    unPrune: false,
  },
  systemd: {
    user: 'root',
    group: 'node-service',
    entryPoint: 'dist/index.js',
  },
});
```
