import * as templates from "../templates/index.js";
import { createFile, type Feature, removeFile, setScript } from "./types.js";

export const DockerFeature: Feature = {
  name: "Docker",
  shouldRun: (cfg) => cfg.docker,
  apply: (cwd, cfg, fs, packageJson) => {
    const content = cfg.website ? templates.dockerConfigWebsite : templates.dockerConfigBackend;
    const a = createFile(cwd, "Dockerfile", content, cfg, fs);
    const b = createFile(cwd, ".dockerignore", templates.dockerIgnore, cfg, fs);

    // A scope's "@" isn't valid in an image name, so a scoped package's image is named for the package alone.
    const image = String(packageJson.name).replace(/^@[^/]+\//, "");
    // NODE_AUTH_TOKEN (a token with read:packages) lets the build install @apollogeddon packages
    setScript(packageJson, cfg, "docker:build", `docker build --secret id=npm_token,env=NODE_AUTH_TOKEN -t ${image} .`);
    const ports = cfg.website ? "8080:80" : "3000:3000";
    setScript(packageJson, cfg, "docker:run", `docker run --rm -p ${ports} ${image}`);

    return a && b;
  },
  cleanup: (cwd, cfg, fs) => {
    if (!cfg.docker) {
      removeFile(cwd, "Dockerfile", cfg, fs);
      removeFile(cwd, ".dockerignore", cfg, fs);
    }
  },
};
