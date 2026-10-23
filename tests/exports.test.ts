import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json" with { type: "json" };

const rootDir = process.cwd();

describe("Package Integrity", () => {
  it('should ensure all files listed in "exports" exist', () => {
    // a condition map, such as { types, import }, names a file per condition
    const targets = Object.values(packageJson.exports).flatMap((target) =>
      typeof target === "string" ? [target] : Object.values(target),
    );
    for (const target of targets) {
      expect(fs.existsSync(path.join(rootDir, target)), `File not found: ${target}`).toBe(true);
    }
  });

  it('should ensure all files listed in "files" exist', () => {
    for (const fileGlob of packageJson.files) {
      // dist/ only exists after a build
      if (fileGlob === "dist" || fileGlob.startsWith("dist/") || fileGlob.startsWith("dist\\")) {
        continue;
      }
      expect(fs.globSync(fileGlob, { cwd: rootDir }).length, `Nothing matches: ${fileGlob}`).toBeGreaterThan(0);
    }
  });
});
