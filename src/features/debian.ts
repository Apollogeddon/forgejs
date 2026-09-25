import * as templates from "../templates/index.js";
import { createFile, type Feature, removeFile, setScript } from "./types.js";

export const DebianFeature: Feature = {
  name: "Debian Packaging",
  shouldRun: (cfg) => cfg.debian,
  apply: (cwd, cfg, fs, packageJson) => {
    const ok = createFile(cwd, "snodeb.config.cjs", templates.snodebConfig, cfg, fs);
    setScript(packageJson, cfg, "build:deb", "snodeb");
    return ok;
  },
  cleanup: (cwd, cfg, fs) => {
    if (!cfg.debian) {
      removeFile(cwd, "snodeb.config.cjs", cfg, fs);
    }
  },
};
