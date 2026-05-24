import * as templates from "../templates/index.js";
import { createFile, type Feature, removeFile } from "./types.js";

export const TestingFeature: Feature = {
  name: "Testing",
  shouldRun: (cfg) => cfg.testing,
  apply: (cwd, cfg, fs, packageJson) => {
    const ok = createFile(cwd, "vitest.config.ts", templates.vitestConfig, cfg, fs);
    packageJson.scripts.test = "vitest run";
    return ok;
  },
  cleanup: (cwd, cfg, fs) => {
    if (!cfg.testing) {
      removeFile(cwd, "vitest.config.ts", cfg, fs);
    }
  },
};
