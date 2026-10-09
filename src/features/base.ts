import * as templates from "../templates/index.js";
import { createFile, createFileIfMissing, type Feature, usesAstro } from "./types.js";

export const BaseFeature: Feature = {
  name: "Base Setup",
  shouldRun: () => true,
  apply: (cwd, cfg, fs, packageJson) => {
    const tsconfig = cfg.website ? templates.websiteTsconfigConfig : templates.tsconfigConfig;
    let ok = createFile(cwd, "tsconfig.json", tsconfig, cfg, fs);

    if (packageJson.type !== "module") {
      packageJson.type = "module";
      console.log("✅ Set 'type': 'module' in package.json");
    }

    if (!cfg.library) {
      packageJson.private = true;
      console.log(`✅ Set 'private': true in package.json (${cfg.website ? "website" : "service"} mode)`);
    }

    // tsc/tsup/vite all need real source to exist, so scaffold a starter file now.
    if (cfg.website && usesAstro(packageJson)) {
      console.log("ℹ️  Astro project detected: keeping its own pages instead of index.html and src/main.ts");
    } else if (cfg.website) {
      ok = createFileIfMissing(cwd, "index.html", templates.indexHtml(packageJson.name), cfg, fs) && ok;
      ok = createFileIfMissing(cwd, "src/main.ts", templates.mainTs(packageJson.name), cfg, fs) && ok;
    } else {
      ok = createFileIfMissing(cwd, "src/index.ts", templates.indexTs(packageJson.name), cfg, fs) && ok;
    }

    return ok;
  },
  cleanup: () => {},
};
