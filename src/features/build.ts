import * as templates from "../templates/index.js";
import { createFile, type Feature, removeFile, setScript, usesAstro } from "./types.js";

export const BuildFeature: Feature = {
  name: "Build",
  shouldRun: () => true,
  apply: (cwd, cfg, fs, packageJson) => {
    let ok = true;
    if (cfg.website && usesAstro(packageJson)) {
      // astro.config.mjs configures Vite itself; astro sync generates the types tsc checks
      setScript(packageJson, cfg, "dev", "astro dev");
      setScript(packageJson, cfg, "build", "astro build");
      setScript(packageJson, cfg, "preview", "astro preview");
      setScript(packageJson, cfg, "type", "astro sync && tsc --noEmit");
    } else if (cfg.website) {
      ok = createFile(cwd, "vite.config.ts", templates.viteConfig, cfg, fs);
      setScript(packageJson, cfg, "dev", "vite");
      setScript(packageJson, cfg, "build", "vite build");
      setScript(packageJson, cfg, "preview", "vite preview");
      setScript(packageJson, cfg, "type", "tsc --noEmit");
    } else {
      ok = createFile(cwd, "tsup.config.ts", templates.tsupConfig, cfg, fs);
      setScript(packageJson, cfg, "watch", "tsx watch src/index.ts");
      setScript(packageJson, cfg, "start", "node dist/index.js");
      setScript(packageJson, cfg, "build", "tsup");
      setScript(packageJson, cfg, "type", "tsc --noEmit");
      // Default main is "index.js", but tsup builds to dist/ - fails publint otherwise.
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
      removeFile(cwd, "tsup.config.ts", cfg, fs);
    }
  },
};
