---
title: Examples
description: Common configuration patterns and workflow recipes for Forge.js projects.
---

Solutions for common requirements and configuration patterns.

## Configuration Patterns

### Ignoring Files in Biome

Biome 2 selects files with `files.includes`; prefix a pattern with `!` to exclude it. Keep `extends` so the shared rules still apply:

```json
{
  "$schema": "node_modules/@biomejs/biome/configuration_schema.json",
  "extends": ["node_modules/@apollogeddon/forgejs/configs/biome.json"],
  "files": {
    "includes": ["**", "!src/generated/**", "!public/**"]
  }
}
```

### Enforcing Coverage Thresholds

Configure `coverage.thresholds` in `vitest.config.ts` to fail the run when coverage drops:

```ts
import baseConfig from "@apollogeddon/forgejs/vitest.config.cjs";
import { mergeConfig } from "vitest/config";

export default mergeConfig(baseConfig, {
  test: {
    coverage: {
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
```

### Multiple Entry Points (Tsup)

For libraries that export sub-modules (e.g. `import { util } from "my-lib/util"`), give Tsup several entry points:

```ts
import baseConfig from "@apollogeddon/forgejs/tsup.config.cjs";
import { defineConfig } from "tsup";

export default defineConfig({
  ...baseConfig,
  entry: ["src/index.ts", "src/utils.ts", "src/components/index.ts"],
  splitting: true,
});
```

### Adding Your Own Scripts

Add scripts alongside the generated ones. npm runs a `pre<script>` hook automatically, which suits code generation before a build:

```json
{
  "scripts": {
    "prebuild": "prisma generate",
    "build": "tsup"
  }
}
```

Forge.js never removes scripts it didn't create.

## Workflow Patterns

### Monorepo Execution

Point a workflow at a sub-directory with `working_directory`:

```yaml
jobs:
  api:
    uses: apollogeddon/forgejs/.github/workflows/service.yml@main
    permissions:
      contents: write
      pull-requests: write
    with:
      working_directory: 'packages/api'
      node_version: '22'
    secrets: inherit
```

### Testing Across Node Versions

Call `testing.yml` from a matrix to run the quality and test jobs on several Node.js versions:

```yaml
jobs:
  test:
    strategy:
      matrix:
        node: ['22', '24']
    uses: apollogeddon/forgejs/.github/workflows/testing.yml@main
    with:
      node_version: ${{ matrix.node }}
      # artifact names must be unique per run, and security patching should only run once
      artifact_name: dist-node-${{ matrix.node }}
      auto_patch: false
```

### Build-Time Environment Variables

Pass `build_env_vars` to write variables into `.env` before the build — useful for public API keys a static site needs at build time:

```yaml
jobs:
  website:
    uses: apollogeddon/forgejs/.github/workflows/website.yml@main
    with:
      build_env_vars: "PUBLIC_API_URL=${{ vars.PUBLIC_API_URL }}"
```

### Building Docker Images for More Platforms

With `--docker`, CI builds `linux/amd64` and `linux/arm64`. Add platforms with the `docker` job's `platforms` input:

```yaml
jobs:
  docker:
    needs: service
    uses: apollogeddon/forgejs/.github/workflows/docker.yml@main
    permissions:
      contents: read
      packages: write
    with:
      push: ${{ github.ref == 'refs/heads/main' && needs.service.outputs.new_release_published == 'true' }}
      version: ${{ needs.service.outputs.version }}
      platforms: 'linux/amd64,linux/arm64,linux/arm/v7'
    secrets: inherit
```
