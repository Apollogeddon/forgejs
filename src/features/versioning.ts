import * as templates from "../templates/index.js";
import { createFile, type Feature, removeFile } from "./types.js";

export const VersioningFeature: Feature = {
  name: "Versioning",
  shouldRun: (cfg) => cfg.version,
  apply: (cwd, cfg, fs) => {
    return createFile(cwd, "commitlint.config.ts", templates.commitlintConfig, cfg, fs);
  },
  cleanup: (cwd, cfg, fs) => {
    if (!cfg.version) {
      removeFile(cwd, "commitlint.config.ts", cfg, fs);
    }
  },
};
