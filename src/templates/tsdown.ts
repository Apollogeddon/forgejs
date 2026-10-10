export const tsdownConfig = `\
import baseConfig from "@apollogeddon/forgejs/tsdown.config.cjs";
import { defineConfig } from "tsdown";

export default defineConfig({
  ...baseConfig,
});
`;
