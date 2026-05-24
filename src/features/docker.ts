import * as templates from "../templates/index.js";
import { createFile, type Feature, removeFile } from "./types.js";

export const DockerFeature: Feature = {
  name: "Docker",
  shouldRun: (cfg) => cfg.docker,
  apply: (cwd, cfg, fs, packageJson) => {
    const content = cfg.website ? templates.dockerConfigWebsite : templates.dockerConfigBackend;
    const a = createFile(cwd, "Dockerfile", content, cfg, fs);
    const b = createFile(cwd, ".dockerignore", templates.dockerIgnore, cfg, fs);

    packageJson.scripts["docker:build"] = `docker build -t ${packageJson.name} .`;
    packageJson.scripts["docker:run"] = `docker run -p 3000:3000 ${packageJson.name}`;

    return a && b;
  },
  cleanup: (cwd, cfg, fs) => {
    if (!cfg.docker) {
      removeFile(cwd, "Dockerfile", cfg, fs);
      removeFile(cwd, ".dockerignore", cfg, fs);
    }
  },
};
