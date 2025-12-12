import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import packageJson from "../package.json" with { type: "json" };

const rootDir = process.cwd();

describe("Package Integrity", () => {
  it('should ensure all files listed in "exports" exist', () => {
    const exportsField = packageJson.exports;
    if (!exportsField) {
      return; // No exports field, nothing to test
    }

    for (const key in exportsField) {
      if (Object.hasOwn(exportsField, key)) {
        const exportPath = (exportsField as Record<string, unknown>)[key];
        let filePath: string;

        if (typeof exportPath === "string") {
          filePath = exportPath;
        } else if (typeof exportPath === "object" && exportPath !== null) {
          // Handle conditional exports like { "import": "./file.js", "types": "./file.d.ts" }
          // We'll check all paths within the object
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
          continue; // Move to the next export key
        } else {
          // Skip other types or malformed exports
          continue;
        }

        expect(fs.existsSync(path.join(rootDir, filePath)), `File not found: ${filePath}`).toBe(true);
      }
    }
  });

  it('should ensure all files listed in "files" exist', () => {
    const filesField = packageJson.files;
    if (!filesField) {
      return; // No files field, nothing to test
    }

    for (const fileGlob of filesField) {
      // Exclude 'dist' directory itself or files within it
      if (fileGlob === "dist" || fileGlob.startsWith("dist/") || fileGlob.startsWith("dist\\")) {
        continue; // Skip checking the dist directory
      }
      // Basic check for direct file existence. Globs might need more advanced handling.
      // For simplicity, we assume direct file paths for now.
      expect(fs.existsSync(path.join(rootDir, fileGlob)), `File not found: ${fileGlob}`).toBe(true);
    }
  });
});
