export const biomeConfig = JSON.stringify(
  {
    $schema: "node_modules/@biomejs/biome/configuration_schema.json",
    extends: ["node_modules/@apollogeddon/forgejs/biome.json"],
  },
  null,
  2,
);

export const vitestConfig = `\
import baseConfig from '@apollogeddon/forgejs/vitest.config.cjs';
import { mergeConfig } from 'vitest/config';

export default mergeConfig(baseConfig, {
  test: {
    // Project-specific overrides
  }
});
`;

export const releaseConfig = JSON.stringify(
  {
    extends: "@apollogeddon/forgejs/.releaserc.json",
  },
  null,
  2,
);

export const astroConfig = `\
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightTypeDoc from "starlight-typedoc";

export default defineConfig({
  site: "https://example.com",
  integrations: [
    starlight({
      title: "My Project",
      social: {
        github: "https://github.com/example/repo",
      },
      sidebar: [
        {
          label: "Guides",
          items: [
            // { label: 'Example Guide', link: '/guides/example/' },
          ],
        },
        {
          label: "Reference",
          items: [
            {
              label: "API",
              autogenerate: { directory: "api" },
            },
          ],
        },
      ],
      plugins: [
        starlightTypeDoc({
          entryPoints: ["src/index.ts"],
          tsconfig: "./tsconfig.json",
          sidebar: {
            label: "API",
          },
        }),
      ],
    }),
  ],
});
`;

export const starlightContentIndex = `\
---
title: Welcome to My Project
description: Get started with My Project.
template: splash
hero:
  tagline: A great TypeScript library.
  actions:
    - text: View API Docs
      link: /api/
      icon: right-arrow
      variant: primary
---

## Next Steps

[Read the docs](/api/)
`;

export const tsconfigConfig = JSON.stringify(
  {
    extends: "@apollogeddon/forgejs/tsconfig.json",
    compilerOptions: {
      baseUrl: ".",
      rootDir: ".",
    },
    include: ["src/**/*", ".astro/types.d.ts"],
    exclude: ["node_modules", "dist"],
  },
  null,
  2,
);

export const commitlintConfig = `\
import baseConfig from '@apollogeddon/forgejs/commitlint.config.cjs';
import type { UserConfig } from '@commitlint/types';

const Configuration: UserConfig = {
  extends: baseConfig.extends,
  // Add project-specific rules here
};

export default Configuration;
`;

export const lefthookConfig = `# Lefthook Configuration
# Refer to https://github.com/evilmartians/lefthook/blob/master/docs/configuration.md

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
`;

export const tsupConfig = `\
import baseConfig from "@apollogeddon/forgejs/tsup.config.cjs";
import { defineConfig } from "tsup";

export default defineConfig({
  ...baseConfig,
});
`;

export const snodebConfig = `\
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
`;

export const libraryWorkflow = `\
name: CI

on:
  push:
    branches: ["main"]
  pull_request:
    branches: ["main"]

jobs:
  library:
    uses: apollogeddon/forgejs/.github/workflows/library.yml@main
    with:
      node_version: '22'
    secrets: inherit
`;

export const debianWorkflow = `\
name: CI

on:
  push:
    branches: ["main"]
  pull_request:
    branches: ["main"]

jobs:
  debian:
    uses: apollogeddon/forgejs/.github/workflows/debian.yml@main
    with:
      node_version: '22'
    secrets: inherit
`;
