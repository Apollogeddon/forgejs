import fs from "node:fs";
import path from "node:path";
import * as yaml from "js-yaml";
import { describe, expect, it } from "vitest";

const workflowsDir = path.join(process.cwd(), ".github", "workflows");

describe("GitHub Actions Workflows YAML Syntax", () => {
  const workflowFiles = fs.readdirSync(workflowsDir).filter((file) => file.endsWith(".yml"));

  it("should find workflow files to test", () => {
    expect(workflowFiles.length).toBeGreaterThan(0);
  });

  workflowFiles.forEach((file) => {
    it(`should validate YAML syntax for ${file}`, () => {
      const filePath = path.join(workflowsDir, file);
      const fileContent = fs.readFileSync(filePath, "utf-8");

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

  it("should ensure debian.yml only builds on new_release_published", () => {
    const wf = getWorkflow("debian.yml");
    expect(wf.jobs.build.if).toContain("new_release_published");
  });

  it("should ensure library.yml jobs only run on new_release_published", () => {
    const wf = getWorkflow("library.yml");
    expect(wf.jobs.publish.if).toContain("new_release_published");
  });

  it("should ensure website.yml jobs only run on new_release_published", () => {
    const wf = getWorkflow("website.yml");
    expect(wf.jobs.deploy.if).toContain("new_release_published");
  });
});
