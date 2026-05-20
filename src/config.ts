export const dockerConfigBackend = `\
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM gcr.io/distroless/nodejs22-debian12
COPY --from=build /usr/src/app/dist /usr/src/app/dist
COPY --from=build /usr/src/app/node_modules /usr/src/app/node_modules
COPY --from=build /usr/src/app/package.json /usr/src/app/package.json
WORKDIR /usr/src/app
CMD ["dist/index.js"]
`;

export const dockerConfigWebsite = `\
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM nginx:stable-alpine
COPY --from=build /usr/src/app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`;

export const dockerIgnore = `\
node_modules
dist
.git
.github
*.md
`;

export const viteConfig = `\
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  build: {
    outDir: "dist",
  },
});
`;

export const biomeConfig = JSON.stringify(
  {
    $schema: "node_modules/@biomejs/biome/configuration_schema.json",
    extends: ["node_modules/@apollogeddon/forgejs/biome.json"],
  },
  null,
  2,
);

export const vitestConfig = `\
import path from "node:path";
import baseConfig from "@apollogeddon/forgejs/vitest.config.cjs";
import { mergeConfig } from "vitest/config";

export default mergeConfig(baseConfig, {
  resolve: {
    alias: {
      // Manually map alias to avoid 'vite-tsconfig-paths' issues
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    // Project-specific overrides
  },
});
`;

export const astroConfig = `\
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightTypeDoc from "starlight-typedoc";

export default defineConfig({
  site: "https://example.com",
  integrations: [
    starlight({
      title: "My Project",
      social: [
        {
          label: "GitHub",
          url: "https://github.com/example/repo",
          icon: "github",
        },
      ],
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
      auto_patch: true
    secrets: inherit
`;

export const serviceWorkflow = `\
name: CI

on:
  push:
    branches: ["main"]
  pull_request:
    branches: ["main"]

jobs:
  service:
    uses: apollogeddon/forgejs/.github/workflows/service.yml@main
    with:
      node_version: '22'
      auto_patch: true
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
      auto_patch: true
    secrets: inherit
`;
