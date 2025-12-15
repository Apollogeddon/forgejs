export const biomeConfig = JSON.stringify(
  {
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

export const typedocConfig = JSON.stringify(
  {
    extends: ["@apollogeddon/forgejs/typedoc.json"],
    entryPoints: ["src/index.ts"],
    out: "docs",
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
