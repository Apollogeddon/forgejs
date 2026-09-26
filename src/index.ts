#!/usr/bin/env node
import { parseArgs } from "node:util";
import { init } from "./core.js";

const options = {
  backend: { type: "boolean" },
  library: { type: "boolean" },
  website: { type: "boolean" },

  // Optional opt-in features
  debian: { type: "boolean" },
  docker: { type: "boolean" },

  // Standard features: each has an explicit --no-<x> negation, since node:util's
  // parseArgs has no built-in negation support for boolean flags.
  version: { type: "boolean" },
  "no-version": { type: "boolean" },
  testing: { type: "boolean" },
  "no-testing": { type: "boolean" },
  linting: { type: "boolean" },
  "no-linting": { type: "boolean" },

  force: { type: "boolean" },
  all: { type: "boolean" },
  "no-all": { type: "boolean" },
  "dry-run": { type: "boolean" },
  help: { type: "boolean" },
} as const;

function parseCliArgs() {
  try {
    return parseArgs({
      args: process.argv.slice(2),
      options,
      strict: true,
      allowPositionals: true,
    });
  } catch (error) {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

const { values, positionals } = parseCliArgs();

// --help takes priority over everything else, including mode/flag validation
if (values.help) {
  showHelp();
  process.exit(0);
}

const command = positionals[0];

function resolveFeature(flag: boolean | undefined, negated: boolean | undefined, enableByDefault: boolean): boolean {
  if (negated) return false;
  return !!(flag ?? enableByDefault);
}

const modes = ["backend", "library", "website"];
const hasModeFlag = modes.some((mode) => values[mode as keyof typeof values]);

// Standard features default on unless --no-all is passed
const enableByDefault = !values["no-all"] && values.all !== false;

// If no mode flag is provided, backend is the default
const isBackend = !!(values.backend || (!hasModeFlag && enableByDefault));
const isLibrary = !!values.library;
const isWebsite = !!values.website;

const activeModes = [isBackend, isLibrary, isWebsite].filter(Boolean);
if (activeModes.length > 1) {
  console.error("❌ Error: Only one mode (--backend, --library, --website) can be active at a time.");
  process.exit(1);
}

const config = {
  force: !!values.force,
  dryRun: !!values["dry-run"],

  backend: isBackend,
  library: isLibrary,
  website: isWebsite,

  testing: resolveFeature(values.testing, values["no-testing"], enableByDefault),
  version: resolveFeature(values.version, values["no-version"], enableByDefault),
  linting: resolveFeature(values.linting, values["no-linting"], enableByDefault),

  debian: !!values.debian,
  docker: !!values.docker,
};

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

Standard Features (Enabled by default; disable with --no-<feature> or --no-all):
  --testing   Setup Testing (vitest)
  --version   Setup Versioning (release-please, commitlint)
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
