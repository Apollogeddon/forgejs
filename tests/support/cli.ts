import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

export const CLI_SCRIPT = path.resolve(__dirname, "../../src/index.ts");

// Invoking the local tsx binary directly, rather than `npx tsx` from an unrelated tempDir cwd,
// avoids npx re-resolving/installing tsx per call - a source of npm cache races under CI parallelism.
const require = createRequire(import.meta.url);
const tsxPackageJsonPath = require.resolve("tsx/package.json");
export const TSX_CLI = path.join(path.dirname(tsxPackageJsonPath), require(tsxPackageJsonPath).bin);

// Retries because Windows can briefly hold locks on just-used files
export function robustRemoveDir(dir: string, maxRetries = 5, delay = 500) {
  if (!fs.existsSync(dir)) return;

  for (let i = 0; i < maxRetries; i++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      if (i === maxRetries - 1) {
        console.warn(`Warning: Final attempt to clean up temp dir failed: ${error}`);
      } else {
        const end = Date.now() + delay;
        while (Date.now() < end) {}
      }
    }
  }
}
