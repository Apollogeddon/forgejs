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
      ignoreDeprecations: "5.0",
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

export const tsupConfig = `\
import baseConfig from "@apollogeddon/forgejs/tsup.config.cjs";
import { defineConfig } from "tsup";

export default defineConfig({
  ...baseConfig,
});
`;
