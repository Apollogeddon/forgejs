export const biomeConfig = JSON.stringify(
  {
    extends: ["node_modules/@apollogeddon/forgejs/biome.json"],
  },
  null,
  2,
);

export const vitestConfig = `import { mergeConfig } from 'vitest/config';
import baseConfig from '@apollogeddon/forgejs/vitest.config.cjs';

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

export const commitlintConfig = `import type { UserConfig } from '@commitlint/types';
import baseConfig from '@apollogeddon/forgejs/commitlint.config.cjs';

const Configuration: UserConfig = {
  extends: baseConfig.extends,
  // Add project-specific rules here
};

export default Configuration;
`;

export const tsdownConfig = `import { defineConfig } from "tsdown";
import baseConfig from "@apollogeddon/forgejs/tsdown.config.cjs";

export default defineConfig({
  ...baseConfig,
  // Override or add project-specific properties here
  entry: ["./src/index.ts"],
});
`;
