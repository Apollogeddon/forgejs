import * as templates from "../templates/index.js";
import { createFile, type Feature, removeFile } from "./types.js";

export const BuildFeature: Feature = {
  name: "Build",
  shouldRun: () => true,
  apply: (cwd, cfg, fs, packageJson) => {
    let ok = true;
    if (cfg.website) {
      ok = createFile(cwd, "vite.config.ts", templates.viteConfig, cfg, fs);
      packageJson.scripts.dev = "vite";
      packageJson.scripts.build = "vite build";
      packageJson.scripts.preview = "vite preview";
      packageJson.scripts.type = "tsc --noEmit";
    } else {
      ok = createFile(cwd, "tsup.config.ts", templates.tsupConfig, cfg, fs);
      packageJson.scripts.watch = "tsx watch src/index.ts";
      packageJson.scripts.start = "node dist/index.js";
      packageJson.scripts.build = "tsup";
      packageJson.scripts.type = "tsc --noEmit";
    }

    if (cfg.library) {
      packageJson.scripts.publint = "publint";
    }

    return ok;
  },
  cleanup: (cwd, cfg, fs) => {
    if (!cfg.website) {
      removeFile(cwd, "vite.config.ts", cfg, fs);
    } else {
      removeFile(cwd, "tsup.config.ts", cfg, fs);
    }
  },
};
