import * as templates from "../templates/index.js";
import { createFile, type Feature, removeFile, setScript } from "./types.js";

export const BuildFeature: Feature = {
  name: "Build",
  shouldRun: () => true,
  apply: (cwd, cfg, fs, packageJson) => {
    let ok = true;
    if (cfg.website) {
      ok = createFile(cwd, "vite.config.ts", templates.viteConfig, cfg, fs);
      setScript(packageJson, cfg, "dev", "vite");
      setScript(packageJson, cfg, "build", "vite build");
      setScript(packageJson, cfg, "preview", "vite preview");
      setScript(packageJson, cfg, "type", "tsc --noEmit");
    } else {
      ok = createFile(cwd, "tsdown.config.ts", templates.tsdownConfig, cfg, fs);
      setScript(packageJson, cfg, "watch", "tsx watch src/index.ts");
      setScript(packageJson, cfg, "start", "node dist/index.js");
      setScript(packageJson, cfg, "build", "tsdown");
      setScript(packageJson, cfg, "type", "tsc --noEmit");
      // Default main is "index.js", but tsdown builds to dist/ - fails publint otherwise.
      packageJson.main = "dist/index.js";
      packageJson.types = "dist/index.d.ts";
    }

    if (cfg.library) {
      setScript(packageJson, cfg, "publint", "publint");
    }

    return ok;
  },
  cleanup: (cwd, cfg, fs) => {
    if (!cfg.website) {
      removeFile(cwd, "vite.config.ts", cfg, fs);
    } else {
      removeFile(cwd, "tsdown.config.ts", cfg, fs);
    }
    // Forge.js bundled with tsup before 4.0; with --force, init removes the config it left
    removeFile(cwd, "tsup.config.ts", cfg, fs);
  },
};
