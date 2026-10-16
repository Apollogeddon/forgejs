import * as templates from "../templates/index.js";
import { createFile, createFileIfMissing, type Feature, nodeVersion } from "./types.js";

export const BaseFeature: Feature = {
  name: "Base Setup",
  shouldRun: () => true,
  apply: (cwd, cfg, fs, packageJson) => {
    const node = nodeVersion(cwd, cfg, fs);
    const nvmrc = fs.join(cwd, ".nvmrc");
    if (cfg.node === undefined && fs.existsSync(nvmrc)) {
      const pinned = fs.readFileSync(nvmrc, "utf-8").trim();
      if (pinned.replace(/^v/, "") !== node) {
        console.warn(`⚠️  .nvmrc's "${pinned}" isn't a Node.js version init can use; engines and Docker get ${node}.`);
      }
    }
    // an explicit --node replaces the version the project had, as --force would
    const pin = cfg.node === undefined ? cfg : { ...cfg, force: true };
    const tsconfig = cfg.website ? templates.websiteTsconfigConfig : templates.tsconfigConfig;
    let ok = createFile(cwd, "tsconfig.json", tsconfig, cfg, fs);
    ok = createFile(cwd, ".editorconfig", templates.editorconfig, cfg, fs) && ok;
    // The one place the project's Node.js version lives: nvm, setup-node and CI all read it
    ok = createFile(cwd, ".nvmrc", `${node}\n`, pin, fs) && ok;

    const engines = (packageJson.engines ?? {}) as Record<string, string>;
    if (engines.node === undefined || pin.force) {
      packageJson.engines = { ...engines, node: `>=${node}` };
      console.log(`✅ Set 'engines.node': '>=${node}' in package.json`);
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
