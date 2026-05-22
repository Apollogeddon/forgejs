import * as templates from "./config.js";
import { type IFileSystem, NodeFileSystem } from "./utils/filesystem.js";

export interface InitConfig {
  force: boolean;
  dryRun: boolean;
  backend: boolean;
  library: boolean;
  website: boolean;
  debian: boolean;
  docker: boolean;
  testing: boolean;
  version: boolean;
  linting: boolean;
  typedoc: boolean;
}

export function init(cfg: InitConfig, fs: IFileSystem = new NodeFileSystem()): number {
  const cwd = fs.cwd();
  let hasError = false;

  console.log(`Initializing Forge.js in ${cwd}...`);
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

  // 1. Base Setup
  if (!setupBase(cwd, cfg, fs)) hasError = true;

  // 2. Linting
  if (cfg.linting) {
    if (!setupLinting(cwd, cfg, fs)) hasError = true;
  }

  // 3. Build (Different for website)
  if (cfg.website) {
    if (!setupWebsite(cwd, cfg, fs)) hasError = true;
  } else {
    if (!setupBuild(cwd, cfg, fs)) hasError = true;
  }

  // 4. Testing
  if (cfg.testing) {
    if (!setupTesting(cwd, cfg, fs)) hasError = true;
  }

  // 5. Versioning
  if (cfg.version) {
    if (!setupVersioning(cwd, cfg, fs)) hasError = true;
  }

  // 6. Docs / TypeDoc
  if (cfg.typedoc) {
    if (!setupDocs(cwd, cfg, fs)) hasError = true;
  }

  // 7. Docker
  if (cfg.docker) {
    if (!setupDocker(cwd, cfg, fs)) hasError = true;
  }

  // 8. Debian
  if (cfg.debian) {
    if (!setupDebian(cwd, cfg, fs)) hasError = true;
  }

  // 9. Workflows
  if (!setupWorkflows(cwd, cfg, fs)) hasError = true;

  // 10. Package.json Scripts
  if (!updatePackageJson(cwd, cfg, fs)) hasError = true;

  // 11. Cleanup Obsolete Files
  cleanup(cwd, cfg, fs);

  if (hasError) {
    console.error("\n❌ Initialization completed with errors.");
    return 1;
  }

  console.log("\nInitialization complete!");
  console.log("Next steps:");
  console.log('1. Run "npm install" to ensure dependencies are linked.');
  if (cfg.linting) {
    console.log('2. Run "npx lefthook install" to set up git hooks.');
  }
  return 0;
}

function cleanup(cwd: string, cfg: InitConfig, fs: IFileSystem) {
  const toRemove: string[] = [];

  // Cleanup Library/TypeDoc files
  if (!cfg.typedoc) {
    toRemove.push("astro.config.mjs");
    toRemove.push("src/content/docs/index.mdx");
  }

  // Cleanup Website files
  if (!cfg.website) {
    toRemove.push("vite.config.ts");
  } else {
    // Website uses Vite, so remove Tsup
    toRemove.push("tsup.config.ts");
  }

  // Cleanup Backend/Library Build files (Tsup)
  if (!cfg.library && !cfg.backend && !cfg.debian) {
    // If it's a website, tsup is already marked for removal above.
    // If it's none of the above (unlikely given default), cleanup tsup.
    toRemove.push("tsup.config.ts");
  }

  // Cleanup Debian files
  if (!cfg.debian) {
    toRemove.push("snodeb.config.cjs");
  }

  // Cleanup Docker files
  if (!cfg.docker) {
    toRemove.push("Dockerfile");
    toRemove.push(".dockerignore");
  }

  // Cleanup Testing files
  if (!cfg.testing) {
    toRemove.push("vitest.config.ts");
  }

  // Cleanup Versioning files
  if (!cfg.version) {
    toRemove.push("commitlint.config.ts");
  }

  // Cleanup Linting files
  if (!cfg.linting) {
    toRemove.push("biome.json");
    toRemove.push("lefthook.yml");
  }

  for (const file of toRemove) {
    const filePath = fs.join(cwd, file);
    if (fs.existsSync(filePath)) {
      if (!cfg.force) {
        console.log(`⚠️  Skipping removal of obsolete file: ${file} (use --force to delete)`);
        continue;
      }

      if (cfg.dryRun) {
        console.log(`[DryRun] Would remove obsolete file: ${file}`);
      } else {
        try {
          fs.unlinkSync(filePath);
          console.log(`🗑️  Removed obsolete file: ${file}`);
        } catch (e) {
          console.warn(`⚠️  Failed to remove ${file}: ${e}`);
        }
      }
    }
  }
}

function createFile(cwd: string, fileName: string, content: string, cfg: InitConfig, fs: IFileSystem): boolean {
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

function setupBase(cwd: string, cfg: InitConfig, fs: IFileSystem): boolean {
  return createFile(cwd, "tsconfig.json", templates.tsconfigConfig, cfg, fs);
}

function setupLinting(cwd: string, cfg: InitConfig, fs: IFileSystem): boolean {
  const a = createFile(cwd, "biome.json", templates.biomeConfig, cfg, fs);
  const b = createFile(cwd, "lefthook.yml", templates.lefthookConfig, cfg, fs);
  return a && b;
}

function setupBuild(cwd: string, cfg: InitConfig, fs: IFileSystem): boolean {
  return createFile(cwd, "tsup.config.ts", templates.tsupConfig, cfg, fs);
}

function setupWebsite(cwd: string, cfg: InitConfig, fs: IFileSystem): boolean {
  return createFile(cwd, "vite.config.ts", templates.viteConfig, cfg, fs);
}

function setupTesting(cwd: string, cfg: InitConfig, fs: IFileSystem): boolean {
  return createFile(cwd, "vitest.config.ts", templates.vitestConfig, cfg, fs);
}

function setupVersioning(cwd: string, cfg: InitConfig, fs: IFileSystem): boolean {
  return createFile(cwd, "commitlint.config.ts", templates.commitlintConfig, cfg, fs);
}

function setupDocs(cwd: string, cfg: InitConfig, fs: IFileSystem): boolean {
  const astroInstalled = fs.existsSync(fs.join(cwd, "node_modules", "astro"));
  if (!astroInstalled) {
    console.warn("⚠️  Documentation dependencies (astro, starlight, typedoc) not installed.");
    console.warn("   Run 'npm install' without --omit=optional to install them.");
  }
  const a = createFile(cwd, "astro.config.mjs", templates.astroConfig, cfg, fs);
  const b = createFile(cwd, "src/content/docs/index.mdx", templates.starlightContentIndex, cfg, fs);
  return a && b;
}

function setupDocker(cwd: string, cfg: InitConfig, fs: IFileSystem): boolean {
  const content = cfg.website ? templates.dockerConfigWebsite : templates.dockerConfigBackend;
  const a = createFile(cwd, "Dockerfile", content, cfg, fs);
  const b = createFile(cwd, ".dockerignore", templates.dockerIgnore, cfg, fs);
  return a && b;
}

function setupDebian(cwd: string, cfg: InitConfig, fs: IFileSystem): boolean {
  return createFile(cwd, "snodeb.config.cjs", templates.snodebConfig, cfg, fs);
}

function setupWorkflows(cwd: string, cfg: InitConfig, fs: IFileSystem): boolean {
  let workflowContent = "";
  let workflowName = "";

  if (cfg.debian) {
    workflowContent = templates.debianWorkflow;
    workflowName = ".github/workflows/debian.yml";
  } else if (cfg.library) {
    workflowContent = templates.libraryWorkflow;
    workflowName = ".github/workflows/ci.yml";
  } else if (cfg.backend || cfg.website) {
    workflowContent = templates.serviceWorkflow;
    workflowName = ".github/workflows/ci.yml";
  }

  if (workflowContent && workflowName) {
    return createFile(cwd, workflowName, workflowContent, cfg, fs);
  }
  return true;
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

function updatePackageJson(cwd: string, cfg: InitConfig, fs: IFileSystem): boolean {
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
    return false;
  }

  try {
    if (packageJson.type !== "module") {
      packageJson.type = "module";
      console.log("✅ Set 'type': 'module' in package.json");
    }

    // Safety: Prevent accidental publishing of Backends/Websites
    if (!cfg.library) {
      packageJson.private = true;
      console.log("✅ Set 'private': true in package.json (service mode)");
    }

    const scripts: Record<string, string> = {};

    if (cfg.linting) {
      scripts.lint = "biome check --fix";
      scripts.security = "osv-scanner scan -r .";
      scripts.prepare = "lefthook install";
    }

    if (cfg.website) {
      scripts.dev = "vite";
      scripts.build = "vite build";
      scripts.preview = "vite preview";
    } else {
      scripts.watch = "tsx watch src/index.ts";
      scripts.start = "node dist/index.js";
      scripts.build = "tsup";
      scripts.type = "tsc --noEmit";
    }

    if (cfg.typedoc) {
      scripts["docs:init"] = "astro sync";
      scripts["docs:build"] = "astro build";
      scripts["docs:watch"] = "astro dev";
    }

    if (cfg.library) {
      scripts.publint = "publint";
    }

    if (cfg.testing) {
      scripts.test = "vitest run";
    }

    if (cfg.debian) {
      scripts["build:deb"] = "snodeb";
    }

    if (cfg.docker) {
      scripts["docker:build"] = `docker build -t ${packageJson.name} .`;
      scripts["docker:run"] = `docker run -p 3000:3000 ${packageJson.name}`;
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
    return true;
  } catch (error) {
    console.error("❌ Failed to update package.json:", error instanceof Error ? error.message : String(error));
    return false;
  }
}
