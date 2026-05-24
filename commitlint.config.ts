import baseConfig from "@apollogeddon/forgejs/commitlint.config.cjs";
import type { UserConfig } from "@commitlint/types";

const Configuration: UserConfig = {
  extends: baseConfig.extends,
  // Add project-specific rules here
};

export default Configuration;
