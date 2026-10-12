import * as templates from "../templates/index.js";
import { NODE_VERSION } from "../versions.js";
import { createFile, createFileIfMissing, type Feature } from "./types.js";

export const BaseFeature: Feature = {
  name: "Base Setup",
  shouldRun: () => true,
  apply: (cwd, cfg, fs, packageJson) => {
    const tsconfig = cfg.website ? templates.websiteTsconfigConfig : templates.tsconfigConfig;
    let ok = createFile(cwd, "tsconfig.json", tsconfig, cfg, fs);
    ok = createFile(cwd, ".editorconfig", templates.editorconfig, cfg, fs) && ok;
    // The one place the project's Node.js version lives: nvm, setup-node and CI all read it
    ok = createFile(cwd, ".nvmrc", `${NODE_VERSION}\n`, cfg, fs) && ok;

    const engines = (packageJson.engines ?? {}) as Record<string, string>;
    if (engines.node === undefined || cfg.force) {
      packageJson.engines = { ...engines, node: `>=${NODE_VERSION}` };
      console.log(`✅ Set 'engines.node': '>=${NODE_VERSION}' in package.json`);
    }

    if (packageJson.type !== "module") {
      packageJson.type = "module";
      console.log("✅ Set 'type': 'module' in package.json");
    }

    if (!cfg.library) {
      packageJson.private = true;
      console.log(`✅ Set 'private': true in package.json (${cfg.website ? "website" : "service"} mode)`);
    }

    // tsc/tsdown/vite all need real source to exist, so scaffold a starter file now.
    if (cfg.website) {
      ok = createFileIfMissing(cwd, "index.html", templates.indexHtml(packageJson.name), cfg, fs) && ok;
      ok = createFileIfMissing(cwd, "src/main.ts", templates.mainTs(packageJson.name), cfg, fs) && ok;
    } else {
      ok = createFileIfMissing(cwd, "src/index.ts", templates.indexTs(packageJson.name), cfg, fs) && ok;
    }

    return ok;
  },
  cleanup: () => {},
};
