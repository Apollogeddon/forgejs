---
title: Examples
description: Common configuration patterns and workflow recipes for Forge.js projects.
---

Recipes for common changes to a Forge.js project: overriding the shared configs and adapting the reusable workflows.

## Configuration patterns

### Ignore files in Biome

Biome 2 selects files with `files.includes`. Prefix a pattern with `!` to exclude it, and keep `extends` so the shared rules still apply:

```json
{
  "$schema": "node_modules/@biomejs/biome/configuration_schema.json",
  "extends": ["node_modules/@apollogeddon/forgejs/configs/biome.json"],
  "files": {
    "includes": ["**", "!src/generated/**", "!public/**"]
  }
}
```

### Enforce coverage thresholds

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

### Build multiple entry points with tsdown

For libraries that export sub-modules (e.g. `import { util } from "my-lib/util"`), give tsdown several entry points:

```ts
import baseConfig from "@apollogeddon/forgejs/tsdown.config.cjs";
import { defineConfig } from "tsdown";

export default defineConfig({
  ...baseConfig,
  entry: ["src/index.ts", "src/utils.ts", "src/components/index.ts"],
});
```

### Add your own scripts

Add scripts alongside the generated ones. npm runs a `pre<script>` script automatically before `<script>`, which suits code generation before a build:

```json
{
  "scripts": {
    "prebuild": "prisma generate",
    "build": "tsdown"
  }
}
```

Forge.js never removes scripts, and only overwrites the ones it manages when you pass `--force`.

## Workflow patterns

### Run in a monorepo package

Point the pipelines at a subdirectory with `working_directory`, given relative to the repository root without a leading `./` or trailing `/`. `version.yml` releases that package on its own: release-please only counts commits under the directory, and tags its releases with the package's name (`api-vX.Y.Z`):

```yaml
jobs:
  version:
    if: ${{ github.event_name != 'pull_request' }}
    uses: apollogeddon/forgejs/.github/workflows/version.yml@main
    with:
      working_directory: 'packages/api'
    permissions:
      contents: write
      pull-requests: write

  service:
    needs: version
    if: ${{ !cancelled() && (github.event_name == 'pull_request' || needs.version.outputs.new_release_published == 'true') }}
    uses: apollogeddon/forgejs/.github/workflows/service.yml@main
    with:
      working_directory: 'packages/api'
    permissions:
      contents: read
      packages: read
      pull-requests: write
```

Pass it to `publish.yml` too for a library.

### Test across Node.js versions

Call a check pipeline from a matrix to run its stages on several Node.js versions. The run page names each call after its version, such as `service (lts/*)`:

```yaml
jobs:
  service:
    name: service (${{ matrix.node }})
    strategy:
      matrix:
        node: ['lts/-1', 'lts/*']
    uses: apollogeddon/forgejs/.github/workflows/service.yml@main
    permissions:
      contents: read
      packages: read
      pull-requests: write
    with:
      node_version: ${{ matrix.node }}
      # artifact names must be unique per run
      artifact_name: dist-node-${{ strategy.job-index }}
```

### Set build-time environment variables

Pass `build_env_vars` to write variables into `.env` before the build. Use it for public values a static site needs at build time, such as an API URL. The values end up in the built site, so don't pass secrets this way:

```yaml
jobs:
  website:
    # ...as generated
    uses: apollogeddon/forgejs/.github/workflows/website.yml@main
    with:
      build_env_vars: "PUBLIC_API_URL=${{ vars.PUBLIC_API_URL }}"
```

### Build Docker images for more platforms

With `--docker`, CI builds `linux/amd64` and `linux/arm64`. Add platforms with the `docker` job's `platforms` input:

```yaml
jobs:
  docker:
    needs: [version, service]
    if: ${{ !cancelled() && needs.service.result == 'success' }}
    uses: apollogeddon/forgejs/.github/workflows/docker.yml@main
    permissions:
      contents: read
      packages: write
    with:
      push: ${{ needs.version.outputs.new_release_published == 'true' }}
      version: ${{ needs.version.outputs.version }}
      platforms: 'linux/amd64,linux/arm64,linux/arm/v7'
```
