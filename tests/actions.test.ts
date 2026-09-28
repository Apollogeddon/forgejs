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
  on?: { workflow_call?: { inputs?: Record<string, unknown>; outputs?: Record<string, unknown> } };
  jobs: Record<
    string,
    {
      if?: string;
      uses?: string;
      with?: Record<string, unknown>;
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

describe("Reusable workflow wiring", () => {
  const load = (file: string) =>
    yaml.load(fs.readFileSync(path.join(workflowsDir, file), "utf-8")) as unknown as Workflow;
  const workflowFiles = fs.readdirSync(workflowsDir).filter((file) => file.endsWith(".yml"));

  workflowFiles.forEach((file) => {
    it(`should only call existing local workflows with declared inputs from ${file}`, () => {
      for (const [name, job] of Object.entries(load(file).jobs ?? {})) {
        if (!job.uses?.startsWith("./.github/workflows/")) continue;
        const callee = path.basename(job.uses);
        expect(fs.existsSync(path.join(workflowsDir, callee)), `${file}:${name} calls missing ${callee}`).toBe(true);
        const declared = Object.keys(load(callee).on?.workflow_call?.inputs ?? {});
        for (const input of Object.keys(job.with ?? {})) {
          expect(declared, `${file}:${name} passes undeclared input '${input}' to ${callee}`).toContain(input);
        }
      }
    });
  });
});

describe("Pipeline outputs used by the generated docker job", () => {
  const load = (file: string) =>
    yaml.load(fs.readFileSync(path.join(workflowsDir, file), "utf-8")) as unknown as Workflow;

  it.each(["service.yml", "website.yml", "debian.yml"])("should expose release outputs from %s", (file) => {
    const outputs = Object.keys(load(file).on?.workflow_call?.outputs ?? {});
    expect(outputs).toEqual(expect.arrayContaining(["new_release_published", "version"]));
  });
});
