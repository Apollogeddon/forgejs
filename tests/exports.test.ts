import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json" with { type: "json" };

const rootDir = process.cwd();

describe("Package Integrity", () => {
  it('should ensure all files listed in "exports" exist', () => {
    const exportsField = packageJson.exports;
    if (!exportsField) {
      return;
    }

    for (const key in exportsField) {
      if (Object.hasOwn(exportsField, key)) {
        const exportPath = (exportsField as Record<string, unknown>)[key];
        let filePath: string;

        if (typeof exportPath === "string") {
          filePath = exportPath;
        } else if (typeof exportPath === "object" && exportPath !== null) {
          for (const condition in exportPath) {
            if (Object.hasOwn(exportPath, condition)) {
              const conditionalPath = (exportPath as Record<string, unknown>)[condition];
              if (typeof conditionalPath === "string") {
                expect(fs.existsSync(path.join(rootDir, conditionalPath)), `File not found: ${conditionalPath}`).toBe(
                  true,
                );
              }
            }
          }
          continue;
        } else {
          continue;
        }

        expect(fs.existsSync(path.join(rootDir, filePath)), `File not found: ${filePath}`).toBe(true);
      }
    }
  });

  it('should ensure all files listed in "files" exist', () => {
    const filesField = packageJson.files;
    if (!filesField) {
      return;
    }

    for (const fileGlob of filesField) {
      // dist/ only exists after a build
      if (fileGlob === "dist" || fileGlob.startsWith("dist/") || fileGlob.startsWith("dist\\")) {
        continue;
      }
      expect(fs.globSync(fileGlob, { cwd: rootDir }).length, `Nothing matches: ${fileGlob}`).toBeGreaterThan(0);
    }
  });
});
