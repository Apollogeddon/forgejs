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

export function init(cfg: InitConfig, fs: IFileSystem = new NodeFileSystem()) {
  const cwd = fs.cwd();

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
  setupBase(cwd, cfg, fs);

  // 2. Linting
  if (cfg.linting) {
    setupLinting(cwd, cfg, fs);
  }

  // 3. Build (Different for website)
  if (cfg.website) {
    setupWebsite(cwd, cfg, fs);
  } else {
    setupBuild(cwd, cfg, fs);
  }

  // 4. Testing
  if (cfg.testing) {
    setupTesting(cwd, cfg, fs);
  }

  // 5. Versioning
  if (cfg.version) {
    setupVersioning(cwd, cfg, fs);
  }

  // 6. Docs / TypeDoc
  if (cfg.typedoc) {
    setupDocs(cwd, cfg, fs);
  }

  // 7. Docker
  if (cfg.docker) {
    setupDocker(cwd, cfg, fs);
  }

  // 8. Debian
  if (cfg.debian) {
    setupDebian(cwd, cfg, fs);
  }

  // 9. Workflows
  setupWorkflows(cwd, cfg, fs);

  // 10. Package.json Scripts
  updatePackageJson(cwd, cfg, fs);

  // 11. Cleanup Obsolete Files
  cleanup(cwd, cfg, fs);

  console.log("\nInitialization complete!");
  console.log("Next steps:");
  console.log('1. Run "npm install" to ensure dependencies are linked.');
  if (cfg.linting) {
    console.log('2. Run "npx lefthook install" to set up git hooks.');
  }
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

function setupWebsite(cwd: string, cfg: InitConfig, fs: IFileSystem) {
  createFile(cwd, "vite.config.ts", templates.viteConfig, cfg, fs);
}

function setupTesting(cwd: string, cfg: InitConfig, fs: IFileSystem) {
  createFile(cwd, "vitest.config.ts", templates.vitestConfig, cfg, fs);
}

function setupVersioning(cwd: string, cfg: InitConfig, fs: IFileSystem) {
  createFile(cwd, "commitlint.config.ts", templates.commitlintConfig, cfg, fs);
}

function setupDocs(cwd: string, cfg: InitConfig, fs: IFileSystem) {
  try {
    import.meta.resolve("astro");
  } catch {
    console.warn("⚠️  Documentation dependencies (astro, starlight, typedoc) not installed.");
    console.warn("   Run 'npm install' without --omit=optional to install them.");
  }
  createFile(cwd, "astro.config.mjs", templates.astroConfig, cfg, fs);
  createFile(cwd, "src/content/docs/index.mdx", templates.starlightContentIndex, cfg, fs);
}

function setupDocker(cwd: string, cfg: InitConfig, fs: IFileSystem) {
  const content = cfg.website ? templates.dockerConfigWebsite : templates.dockerConfigBackend;
  createFile(cwd, "Dockerfile", content, cfg, fs);
  createFile(cwd, ".dockerignore", templates.dockerIgnore, cfg, fs);
}

function setupDebian(cwd: string, cfg: InitConfig, fs: IFileSystem) {
  createFile(cwd, "snodeb.config.cjs", templates.snodebConfig, cfg, fs);
}

function setupWorkflows(cwd: string, cfg: InitConfig, fs: IFileSystem) {
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
  } catch (error) {
    console.error("❌ Failed to update package.json:", error instanceof Error ? error.message : String(error));
  }
}
