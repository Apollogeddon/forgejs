import * as templates from "../templates/index.js";
import { createFile, type Feature, removeFile } from "./types.js";

export const LintingFeature: Feature = {
  name: "Linting",
  shouldRun: (cfg) => cfg.linting,
  apply: (cwd, cfg, fs, packageJson) => {
    const a = createFile(cwd, "biome.json", templates.biomeConfig, cfg, fs);
    const b = createFile(cwd, "lefthook.yml", templates.lefthookConfig, cfg, fs);

    packageJson.scripts.lint = "biome check --fix";
    packageJson.scripts.security = "osv-scanner scan -r .";
    packageJson.scripts.prepare = "lefthook install";

    return a && b;
  },
  cleanup: (cwd, cfg, fs) => {
    if (!cfg.linting) {
      removeFile(cwd, "biome.json", cfg, fs);
      removeFile(cwd, "lefthook.yml", cfg, fs);
    }
  },
};
