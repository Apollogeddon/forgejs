import * as templates from "../templates/index.js";
import { createFile, type Feature } from "./types.js";

export const WorkflowFeature: Feature = {
  name: "GitHub Workflows",
  shouldRun: () => true,
  apply: (cwd, cfg, fs) => {
    let workflowContent = "";
    let workflowName = "";

    if (cfg.debian) {
      workflowContent = templates.debianWorkflow;
      workflowName = ".github/workflows/index.yml";
    } else if (cfg.library) {
      workflowContent = templates.libraryWorkflow;
      workflowName = ".github/workflows/index.yml";
    } else if (cfg.website) {
      workflowContent = templates.websiteWorkflow;
      workflowName = ".github/workflows/index.yml";
    } else if (cfg.backend) {
      workflowContent = templates.serviceWorkflow;
      workflowName = ".github/workflows/index.yml";
    }

    if (workflowContent && workflowName) {
      const inputs: Record<string, boolean> = {};
      if (!cfg.testing) inputs.run_tests = false;
      if (!cfg.version) inputs.enable_versioning = false;
      workflowContent = templates.withPipelineInputs(workflowContent, inputs);
      if (cfg.docker) {
        workflowContent = templates.withDocker(workflowContent);
      }
      return createFile(cwd, workflowName, workflowContent, cfg, fs);
    }
    return true;
  },
  cleanup: () => {},
};
