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
      workflowName = ".github/workflows/debian.yml";
    } else if (cfg.library) {
      workflowContent = templates.libraryWorkflow;
      workflowName = ".github/workflows/ci.yml";
    } else if (cfg.backend || cfg.website) {
      workflowContent = templates.serviceWorkflow;
      workflowName = ".github/workflows/ci.yml";
    }

    if (workflowContent && workflowName) {
      return createFile(cwd, workflowName, workflowContent, cfg, fs);
    }
    return true;
  },
  cleanup: () => {},
};
