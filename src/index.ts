#!/usr/bin/env node
import { parseArgs } from "node:util";
import { init } from "./core.js";

// Define available options
const options = {
  // Modes
  backend: { type: "boolean" },
  library: { type: "boolean" },
  website: { type: "boolean" },

  // Features
  debian: { type: "boolean" },
  docker: { type: "boolean" },
  version: { type: "boolean" },
  testing: { type: "boolean" },
  linting: { type: "boolean" },
  // Meta
  force: { type: "boolean" },
  all: { type: "boolean" },
  "dry-run": { type: "boolean" },
  help: { type: "boolean" },
} as const;

// Parse arguments
const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options,
  strict: false, // Allow unknown flags without throwing
});

const command = positionals[0];

// Determine active features
const modes = ["backend", "library", "website"];
const hasModeFlag = modes.some((mode) => values[mode as keyof typeof values]);

// true unless --no-all is explicitly passed; controls whether standard features default on
const enableByDefault = values.all !== false;

// If no mode flag is provided, backend is the default
const isBackend = !!(values.backend || (!hasModeFlag && enableByDefault));
const isLibrary = !!values.library;
const isWebsite = !!values.website;

// Validate: only one mode can be active at a time
const activeModes = [isBackend, isLibrary, isWebsite].filter(Boolean);
if (activeModes.length > 1) {
  console.error("❌ Error: Only one mode (--backend, --library, --website) can be active at a time.");
  process.exit(1);
}

const config = {
  force: !!values.force,
  dryRun: !!values["dry-run"],

  // Modes
  backend: isBackend,
  library: isLibrary,
  website: isWebsite,

  // Standard features: on by default, can be disabled with --no-<feature> or --no-all
  testing: !!(values.testing ?? enableByDefault),
  version: !!(values.version ?? enableByDefault),
  linting: !!(values.linting ?? enableByDefault),

  // Optional opt-in features
  debian: !!values.debian,
  docker: !!values.docker,
};

// Validate Config
if (config.library) {
  if (config.docker) {
    console.error("❌ Error: Docker configuration is not available for Library mode.");
    process.exit(1);
  }
  if (config.debian) {
    console.error("❌ Error: Debian packaging is not available for Library mode.");
    process.exit(1);
  }
}

if (config.website) {
  if (config.debian) {
    console.error("❌ Error: Debian packaging is not available for Website mode.");
    process.exit(1);
  }
}

if (values.help) {
  showHelp();
  process.exit(0);
}

if (command === "init") {
  process.exit(init(config));
} else {
  showHelp();
  process.exit(1);
}

function showHelp() {
  console.log(`
Usage: npx @apollogeddon/forgejs init [options]

Modes (Default is --backend):
  --backend   Setup for Node.js backend/service [Default]
  --library   Setup for TypeScript library
  --website   Setup for Frontend website (Vite/Astro)

Standard Features (Enabled by default):
  --testing   Setup Testing (vitest)
  --version   Setup Versioning (semantic-release, commitlint)
  --linting   Setup Linting & Formatting (biome, lefthook)

Optional Features:
  --docker    Setup Docker configuration
  --debian    Setup Debian packaging (snodeb)

Options:
  --all       Enable all standard features [Default]
  --force     Overwrite existing files (and enforce script standards)
  --dry-run   Simulate the process without making changes
  --help      Show this help message
`);
}
