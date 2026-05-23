import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const workflowsDir = path.join(process.cwd(), ".github", "workflows");

describe("GitHub Actions Workflows YAML Syntax", () => {
  // Get all .yml files in the workflows directory
  const workflowFiles = fs.readdirSync(workflowsDir).filter((file) => file.endsWith(".yml"));

  it("should find workflow files to test", () => {
    expect(workflowFiles.length).toBeGreaterThan(0);
  });

  // Dynamically create a test for each workflow file
  workflowFiles.forEach((file) => {
    it(`should validate YAML syntax for ${file}`, () => {
      const filePath = path.join(workflowsDir, file);
      const fileContent = fs.readFileSync(filePath, "utf-8");

      // Attempt to parse the YAML content. This will throw an error if syntax is invalid.
      expect(() => {
        yaml.load(fileContent);
      }).not.toThrow();
    });
  });
});

interface Workflow {
  jobs: Record<
    string,
    {
      if?: string;
      uses?: string;
      secrets?: string;
      steps?: Array<{
        name?: string;
        if?: string;
        uses?: string;
      }>;
    }
  >;
}

describe("GitHub Actions Job Conditions", () => {
  const getWorkflow = (filename: string) => {
    const content = fs.readFileSync(path.join(workflowsDir, filename), "utf-8");
    return yaml.load(content) as unknown as Workflow;
  };

  it("should ensure debian.yml only builds on new_release_published == 'true'", () => {
    const wf = getWorkflow("debian.yml");
    expect(wf.jobs.build.if).toContain("needs.version.outputs.new_release_published == 'true'");
  });

  it("should ensure library.yml jobs only run on new_release_published == 'true'", () => {
    const wf = getWorkflow("library.yml");
    expect(wf.jobs.publish.if).toContain("needs.version.outputs.new_release_published == 'true'");
  });

  it("should ensure default.yml auto-merges major GitHub actions", () => {
    const wf = getWorkflow("default.yml");
    const autoMergeStep = wf.jobs["auto-merge"].steps?.find((s) => s.name === "Enable auto-merge for Dependabot PRs");
    expect(autoMergeStep).toBeDefined();
    expect(autoMergeStep?.if).toContain("steps.metadata.outputs.package-ecosystem == 'github_actions'");
    expect(autoMergeStep?.if).toContain("steps.metadata.outputs.update-type == 'version-update:semver-major'");
  });
});
