import * as templates from "@/config.js";
import { type IFileSystem, NodeFileSystem } from "@/utils/filesystem.js";

export interface InitConfig {
  force: boolean;
  dryRun: boolean;
  debian: boolean;
  library: boolean;
  testing: boolean;
  version: boolean;
}

export function init(cfg: InitConfig, fs: IFileSystem = new NodeFileSystem()) {
  const cwd = fs.cwd();

  console.log(`Initializing CI templates in ${cwd}...`);
  if (cfg.dryRun) {
    console.log("⚠️  DRY RUN MODE: No files will be created or modified.");
  }
  console.log(
    "Active Features:",
    Object.entries(cfg)
      .filter(([key, val]) => val === true && key !== "force" && key !== "dryRun")
      .map(([key]) => key)
      .join(", "),
  );

  if (cfg.force) {
    console.log("⚠️  Force mode enabled. Existing files will be overwritten.");
  }

  // 1. Base Setup (Always run)
  setupBase(cwd, cfg, fs);

  // 2. Linting (Always run as part of base standard)
  setupLinting(cwd, cfg, fs);

  // 3. Build (Always run)
  setupBuild(cwd, cfg, fs);

  // 4. Testing
  if (cfg.testing) {
    setupTesting(cwd, cfg, fs);
  }

  // 5. Versioning
  if (cfg.version) {
    setupVersioning(cwd, cfg, fs);
  }

  // 6. Library
  if (cfg.library) {
    setupLibrary(cwd, cfg, fs);
  }

  // 7. Debian
  if (cfg.debian) {
    setupDebian(cwd, cfg, fs);
  }

  // 8. Workflows
  setupWorkflows(cwd, cfg, fs);

  // 9. Package.json Scripts
  updatePackageJson(cwd, cfg, fs);

  console.log("\nInitialization complete!");
  console.log("Next steps:");
  console.log('1. Run "npm install" to ensure dependencies are linked.');
  console.log('2. Run "npx lefthook install" to set up git hooks.');
}

function createFile(cwd: string, fileName: string, content: string, cfg: InitConfig, fs: IFileSystem) {
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
  } catch (error) {
    console.error(`❌ Failed to create/write ${fileName}:`, error instanceof Error ? error.message : String(error));
  }
}

function setupBase(cwd: string, cfg: InitConfig, fs: IFileSystem) {
  createFile(cwd, "tsconfig.json", templates.tsconfigConfig, cfg, fs);
}

function setupLinting(cwd: string, cfg: InitConfig, fs: IFileSystem) {
  createFile(cwd, "biome.json", templates.biomeConfig, cfg, fs);
  createFile(cwd, "lefthook.yml", templates.lefthookConfig, cfg, fs);
}

function setupBuild(cwd: string, cfg: InitConfig, fs: IFileSystem) {
  createFile(cwd, "tsup.config.ts", templates.tsupConfig, cfg, fs);
}

function setupTesting(cwd: string, cfg: InitConfig, fs: IFileSystem) {
  createFile(cwd, "vitest.config.ts", templates.vitestConfig, cfg, fs);
}

function setupVersioning(cwd: string, cfg: InitConfig, fs: IFileSystem) {
  createFile(cwd, ".releaserc.json", templates.releaseConfig, cfg, fs);
  createFile(cwd, "commitlint.config.ts", templates.commitlintConfig, cfg, fs);
}

function setupLibrary(cwd: string, cfg: InitConfig, fs: IFileSystem) {
  createFile(cwd, "astro.config.mjs", templates.astroConfig, cfg, fs);
  createFile(cwd, "src/content/docs/index.mdx", templates.starlightContentIndex, cfg, fs);
}

function setupDebian(cwd: string, cfg: InitConfig, fs: IFileSystem) {
  createFile(cwd, "snodeb.config.cjs", templates.snodebConfig, cfg, fs);
}

function setupWorkflows(cwd: string, cfg: InitConfig, fs: IFileSystem) {
  let workflowContent = "";
  let workflowName = "";

  if (cfg.debian) {
    workflowContent = templates.debianWorkflow;
    workflowName = ".github/workflows/ci.yml";
  } else if (cfg.library) {
    workflowContent = templates.libraryWorkflow;
    workflowName = ".github/workflows/ci.yml";
  }

  if (workflowContent && workflowName) {
    createFile(cwd, workflowName, workflowContent, cfg, fs);
  }
}

interface PackageJson {
  name: string;
  version: string;
  description: string;
  main?: string;
  type?: string;
  scripts: Record<string, string>;
  keywords: string[];
  author: string;
  license: string;
  [key: string]: unknown;
}

function updatePackageJson(cwd: string, cfg: InitConfig, fs: IFileSystem) {
  const packageJsonPath = fs.join(cwd, "package.json");
  let packageJson: PackageJson;

  try {
    if (!fs.existsSync(packageJsonPath)) {
      console.log("📝 Creating new package.json");
      packageJson = {
        name: fs.basename(cwd),
        version: "1.0.0",
        description: "",
        main: "index.js",
        scripts: {},
        keywords: [],
        author: "",
        license: "ISC",
      };
    } else {
      packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
    }
  } catch (error) {
    console.error(
      "❌ Failed to parse or read existing package.json:",
      error instanceof Error ? error.message : String(error),
    );
    return;
  }

  try {
    if (packageJson.type !== "module") {
      packageJson.type = "module";
      console.log("✅ Set 'type': 'module' in package.json");
    }

    const scripts: Record<string, string> = {
      watch: "tsx watch src/index.ts",
      start: "tsx src/index.ts",
      lint: "biome check --fix",
      type: "tsc --noEmit",
      build: "tsup",
      prepare: "lefthook install",
    };

    if (cfg.library) {
      scripts["docs:init"] = "astro sync";
      scripts["docs:build"] = "astro build";
      scripts["docs:watch"] = "astro dev";
      scripts.publint = "publint";
    }

    if (cfg.testing) {
      scripts.test = "vitest run";
    }

    if (cfg.debian) {
      scripts["build:deb"] = "snodeb";
    }

    if (cfg.force) {
      packageJson.scripts = {
        ...packageJson.scripts,
        ...scripts,
      };
    } else {
      packageJson.scripts = {
        ...scripts,
        ...packageJson.scripts,
      };
    }

    if (cfg.dryRun) {
      console.log("[DryRun] Would update package.json scripts");
    } else {
      console.log("✅ Updated scripts in package.json");
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }
  } catch (error) {
    console.error("❌ Failed to update package.json:", error instanceof Error ? error.message : String(error));
  }
}
