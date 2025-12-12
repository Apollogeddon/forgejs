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
