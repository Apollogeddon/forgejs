import * as templates from "../templates/index.js";
import { imageName } from "../utils/names.js";
import { createFile, type Feature, nodeVersion, removeFile, setScript } from "./types.js";

export const DockerFeature: Feature = {
  shouldRun: (cfg) => cfg.docker,
  apply: (cwd, cfg, fs, packageJson) => {
    const content = (cfg.website ? templates.dockerConfigWebsite : templates.dockerConfigBackend)(
      nodeVersion(cwd, cfg, fs),
    );
    const dockerfile = fs.join(cwd, "Dockerfile");
    if (cfg.node !== undefined && !cfg.force && fs.existsSync(dockerfile)) {
      if (fs.readFileSync(dockerfile, "utf-8") !== content) {
        console.warn(`⚠️  Dockerfile kept: set its node base images to ${cfg.node}, or re-run with --force.`);
      }
    }
    const a = createFile(cwd, "Dockerfile", content, cfg, fs);
    const b = createFile(cwd, ".dockerignore", templates.dockerIgnore, cfg, fs);

    const image = imageName(packageJson.name ? String(packageJson.name) : fs.basename(cwd));
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
