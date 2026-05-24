---
title: Examples
description: Common configuration patterns and workflow recipes for Forge.js projects.
---

Solutions for common requirements and configuration patterns.

## Configuration Patterns

### Ignoring Files in Biome

To maintain inheritance from the shared configuration while ignoring specific paths (such as generated code or artifacts), use the `files.ignore` array in `biome.json`.

```json
{
  "extends": ["node_modules/@apollogeddon/forgejs/biome.json"],
  "files": {
    "ignore": ["src/generated/**", "**/*.d.ts", "public/**"]
  }
}
```

### Enforcing Coverage Thresholds

Vitest can enforce code coverage requirements during the test run. Configure the `coverage` object in `vitest.config.ts` to fail the build if thresholds are not met.

```ts
import { mergeConfig } from 'vitest/config';
import baseConfig from '@apollogeddon/forgejs/vitest.config.cjs';

export default mergeConfig(baseConfig, {
  test: {
    coverage: {
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
});
```

### Multiple Entry Points (Tsup)

For libraries that export multiple sub-modules (e.g., `import { util } from 'my-lib/util'`), configure Tsup to generate multiple entry points.

```ts
import { defineConfig } from "tsup";
import baseConfig from "@apollogeddon/forgejs/tsup.config.cjs";

export default defineConfig({
  ...baseConfig,
  entry: [
    "src/index.ts",
    "src/utils.ts",
    "src/components/index.ts"
  ],
  splitting: true
});
```

### Lefthook: Linting Staged Files

To improve commit speed, configure Lefthook to run linting only on changed (staged) files.

```yml
pre-commit:
  parallel: true
  commands:
    lint:
      glob: "*.{js,ts,jsx,tsx,json}"
      run: npx @biomejs/biome check --apply {staged_files} && git add {staged_files}
```

## Workflow Patterns

### Monorepo Execution

The workflows support monorepo structures via the `working_directory` input.

```yaml
jobs:
  test-ui:
    uses: apollogeddon/forgejs/.github/workflows/testing.yml@main
    with:
      working_directory: './packages/ui'
```

### Testing Across Node Versions

Use a build matrix strategy to validate compatibility across multiple Node.js versions.

```yaml
jobs:
  test:
    strategy:
      matrix:
        node: ['18', '20', '22']
    uses: apollogeddon/forgejs/.github/workflows/testing.yml@main
    with:
      node_version: ${{ matrix.node }}
```

### Custom Build Steps

For projects requiring code generation (e.g., Prisma, GraphQL Codegen) prior to compilation, use a `prebuild` script in `package.json`. NPM automatically executes this script before `npm run build`.

```json
{
  "scripts": {
    "prebuild": "prisma generate",
    "build": "tsup"
  }
}
```
