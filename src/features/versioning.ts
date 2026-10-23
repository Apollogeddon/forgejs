import * as templates from "../templates/index.js";
import { createFile, type Feature, removeFile } from "./types.js";

export const VersioningFeature: Feature = {
  shouldRun: (cfg) => cfg.versioning,
  apply: (cwd, cfg, fs) => {
    return createFile(cwd, "commitlint.config.ts", templates.commitlintConfig, cfg, fs);
  },
  cleanup: (cwd, cfg, fs) => {
    if (!cfg.versioning) {
      removeFile(cwd, "commitlint.config.ts", cfg, fs);
    }
  },
};
