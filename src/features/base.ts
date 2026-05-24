import * as templates from "../templates/index.js";
import { createFile, type Feature } from "./types.js";

export const BaseFeature: Feature = {
  name: "Base Setup",
  shouldRun: () => true,
  apply: (cwd, cfg, fs, packageJson) => {
    const tsconfig = cfg.website ? templates.websiteTsconfigConfig : templates.tsconfigConfig;
    const ok = createFile(cwd, "tsconfig.json", tsconfig, cfg, fs);

    if (packageJson.type !== "module") {
      packageJson.type = "module";
      console.log("✅ Set 'type': 'module' in package.json");
    }

    if (!cfg.library) {
      packageJson.private = true;
      console.log("✅ Set 'private': true in package.json (service mode)");
    }

    return ok;
  },
  cleanup: () => {},
};
