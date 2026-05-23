# Configuration

The project exports configurations for standard tooling. These can be extended to inherit best practices while allowing for project-specific overrides.

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
import { mergeConfig } from 'vitest/config';
import baseConfig from '@apollogeddon/forgejs/vitest.config.cjs';

export default mergeConfig(baseConfig, {
  test: {
    // Project-specific overrides
  }
});
```

### Commitlint — Commit Message Linting

Extend the shared commitlint configuration in `commitlint.config.ts`:

```ts
import type { UserConfig } from '@commitlint/types';
import baseConfig from '@apollogeddon/forgejs/commitlint.config.cjs';

const Configuration: UserConfig = {
  extends: [baseConfig.extends],
  // Add project-specific rules here
};

export default Configuration;
```

### Lefthook — Git Hooks

To use the shared Lefthook configuration, copy it into the project root:

```bash
cp node_modules/@apollogeddon/forgejs/lefthook.yml ./lefthook.yml
```

## Build & Release

### Tsup — TypeScript Bundler

Import the base configuration and override properties in `tsup.config.ts`:

```ts
import { defineConfig } from "tsup";
import baseConfig from "@apollogeddon/forgejs/tsup.config.cjs";

export default defineConfig({
  ...baseConfig,
  // Override or add project-specific properties here
  entry: ["./src/index.ts"],
});
```

### Semantic Release

Inherit the release rules in `.releaserc.json`:

```json
{
  "extends": "@apollogeddon/forgejs/.releaserc.json"
}
```

*For Helm chart projects, use `"extends": "@apollogeddon/forgejs/.releaserc.helm.json"`.*

### Snodeb — Debian Packaging

Import the base configuration and override properties in `snodeb.config.ts`:

```ts
import { defineSnodebConfig } from "snodeb";
import baseConfig from "@apollogeddon/forgejs/snodeb.config.cjs";

export default defineSnodebConfig({
  ...baseConfig,
  // Override or add project-specific properties here
  files: {
    ...baseConfig.files,
    include: ["dist/index.js"],
  },
});
```
