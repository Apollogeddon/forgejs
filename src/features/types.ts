import type { InitConfig, PackageJson } from "../types.js";
import type { IFileSystem } from "../utils/filesystem.js";

export interface Feature {
  name: string;
  shouldRun: (cfg: InitConfig) => boolean;
  apply: (cwd: string, cfg: InitConfig, fs: IFileSystem, packageJson: PackageJson) => boolean;
  cleanup: (cwd: string, cfg: InitConfig, fs: IFileSystem) => void;
}

export function createFile(cwd: string, fileName: string, content: string, cfg: InitConfig, fs: IFileSystem): boolean {
  try {
    const filePath = fs.join(cwd, fileName);
    const dirPath = fs.dirname(filePath);

    if (!fs.existsSync(dirPath) && !cfg.dryRun) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    if (fs.existsSync(filePath) && !cfg.force) {
      console.log(`⚠️  ${fileName} already exists. Skipping.`);
    } else {
      const exists = fs.existsSync(filePath);
      if (cfg.dryRun) {
        console.log(`[DryRun] Would ${exists ? "overwrite" : "create"} ${fileName}`);
      } else {
        fs.writeFileSync(filePath, content);
        console.log(`✅ ${exists ? "Overwrote" : "Created"} ${fileName}`);
      }
    }
    return true;
  } catch (error) {
    console.error(`❌ Failed to create/write ${fileName}:`, error instanceof Error ? error.message : String(error));
    return false;
  }
}

export function removeFile(cwd: string, fileName: string, cfg: InitConfig, fs: IFileSystem) {
  const filePath = fs.join(cwd, fileName);
  if (fs.existsSync(filePath)) {
    if (!cfg.force) {
      console.log(`⚠️  Skipping removal of obsolete file: ${fileName} (use --force to delete)`);
      return;
    }

    if (cfg.dryRun) {
      console.log(`[DryRun] Would remove obsolete file: ${fileName}`);
    } else {
      try {
        fs.unlinkSync(filePath);
        console.log(`🗑️  Removed obsolete file: ${fileName}`);
      } catch (e) {
        console.warn(`⚠️  Failed to remove ${fileName}: ${e}`);
      }
    }
  }
}
