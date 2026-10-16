#!/usr/bin/env node
import { parseArgs } from "node:util";
import { forgejsVersion, init } from "./core.js";
import { NODE_VERSION, validNodeVersion } from "./versions.js";

// Options that can't be combined exit with this, as forgego and forgepy do
const EXIT_INVALID_CONFIG = 2;

const options = {
  backend: { type: "boolean" },
  library: { type: "boolean" },
  website: { type: "boolean" },

  // Optional opt-in features
  debian: { type: "boolean" },
  docker: { type: "boolean" },

  // Standard features: each has an explicit --no-<x> negation, since node:util's
  // parseArgs has no built-in negation support for boolean flags.
  versioning: { type: "boolean" },
  "no-versioning": { type: "boolean" },
  testing: { type: "boolean" },
  "no-testing": { type: "boolean" },
  linting: { type: "boolean" },
  "no-linting": { type: "boolean" },

  force: { type: "boolean" },
  all: { type: "boolean" },
  "no-all": { type: "boolean" },
  "dry-run": { type: "boolean" },
  path: { type: "string", short: "C" },
  node: { type: "string" },
  help: { type: "boolean" },
  version: { type: "boolean", short: "V" },
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

// --version prints the version, after init too, rather than scaffold
if (values.version) {
  console.log(`forgejs ${forgejsVersion}`);
  process.exit(0);
}

if (command !== "init") {
  showHelp();
  process.exit(1);
}

function invalid(message: string): never {
  console.error(`❌ Error: ${message}`);
  process.exit(EXIT_INVALID_CONFIG);
}

function resolveFeature(
  [on, off]: [string, string],
  flag: boolean | undefined,
  negated: boolean | undefined,
  enableByDefault: boolean,
): boolean {
  if (flag && negated) invalid(`${on} and ${off} can't both be passed.`);
  if (negated) return false;
  return !!(flag ?? enableByDefault);
}

const modes = ["backend", "library", "website"];
const hasModeFlag = modes.some((mode) => values[mode as keyof typeof values]);

if (values.all && values["no-all"]) invalid("--all and --no-all can't both be passed.");
// Standard features default on unless --no-all is passed
const enableByDefault = !values["no-all"];

// If no mode flag is provided, backend is the default, with --no-all too: that turns
// the standard features off, not the mode
const isBackend = !!(values.backend || !hasModeFlag);
const isLibrary = !!values.library;
const isWebsite = !!values.website;

const activeModes = [isBackend, isLibrary, isWebsite].filter(Boolean);
if (activeModes.length > 1) {
  invalid("Only one mode (--backend, --library, --website) can be active at a time.");
}

const config = {
  force: !!values.force,
  dryRun: !!values["dry-run"],

  backend: isBackend,
  library: isLibrary,
  website: isWebsite,

  testing: resolveFeature(["--testing", "--no-testing"], values.testing, values["no-testing"], enableByDefault),
  versioning: resolveFeature(
    ["--versioning", "--no-versioning"],
    values.versioning,
    values["no-versioning"],
    enableByDefault,
  ),
  linting: resolveFeature(["--linting", "--no-linting"], values.linting, values["no-linting"], enableByDefault),

  debian: !!values.debian,
  docker: !!values.docker,

  ...(values.path === undefined ? {} : { target: values.path }),
  ...(values.node === undefined ? {} : { node: values.node }),
};

if (config.node !== undefined && !validNodeVersion(config.node)) {
  invalid(`--node takes a Node.js version from ${NODE_VERSION} up, such as ${NODE_VERSION} or ${NODE_VERSION}.1.0.`);
}

if (config.library) {
  if (config.docker) invalid("Docker configuration is not available for Library mode.");
  if (config.debian) invalid("Debian packaging is not available for Library mode.");
}

if (config.website && config.debian) invalid("Debian packaging is not available for Website mode.");

process.exit(init(config));

function showHelp() {
  console.log(`
Usage: npx @apollogeddon/forgejs init [options]
       npx @apollogeddon/forgejs --version

Modes (Default is --backend):
  --backend         Setup for Node.js backend/service [Default]
  --library         Setup for TypeScript library
  --website         Setup for Frontend website (Vite)

Standard Features (Enabled by default; disable with --no-<feature> or --no-all):
  --testing         Setup Testing (vitest)
  --versioning      Setup Versioning (release-please, commitlint)
  --linting         Setup Linting & Formatting (biome, lefthook)

Optional Features:
  --docker          Setup Docker configuration
  --debian          Setup Debian packaging (snodeb)

Options:
  --all             Enable all standard features [Default]
  --force           Overwrite existing files (and enforce script standards)
  --dry-run         Simulate the process without making changes
  --node VERSION    Target Node.js version (default: .nvmrc's, else ${NODE_VERSION})
  -C, --path DIR    Target directory (default: current directory)
  -V, --version     Show the Forge.js version
  --help            Show this help message

Invalid combinations of options exit with code 2.
`);
}
