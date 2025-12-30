#!/usr/bin/env node
import { parseArgs } from "node:util";
import { init } from "@/core.js";

// Define available options
const options = {
  debian: { type: "boolean" },
  library: { type: "boolean" },
  version: { type: "boolean" },
  testing: { type: "boolean" },
  force: { type: "boolean" },
  all: { type: "boolean" },
  "dry-run": { type: "boolean" },
  help: { type: "boolean" },
} as const;

// Parse arguments
const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  options,
  strict: false, // Allow other commands like 'init'
});

const command = positionals[0];

// Determine active features
// If no specific feature flags are set, and 'all' is not explicitly false, default to standard stack (library + testing + version)
const specificFlags = ["debian", "library", "version", "testing"];
const hasSpecificFlag = specificFlags.some((flag) => values[flag as keyof typeof values]);
const isDefault = !hasSpecificFlag && values.all !== false;

const config = {
  force: !!values.force,
  dryRun: !!values["dry-run"],
  debian: !!values.debian,
  library: !!(values.library ?? (isDefault || values.all)),
  testing: !!(values.testing ?? (isDefault || values.all)),
  version: !!(values.version ?? (isDefault || values.all)),
};

if (values.help) {
  showHelp();
  process.exit(0);
}

if (command === "init") {
  init(config);
} else {
  showHelp();
  process.exit(1);
}

function showHelp() {
  console.log(`
Usage: npx @apollogeddon/forgejs init [options]

Options:
  --debian    Setup Debian packaging (snodeb)
  --library   Setup Library tooling (tsup, astro, docs) [Default]
  --version   Setup Versioning (semantic-release, commitlint) [Default]
  --testing   Setup Testing (vitest) [Default]
  --all       Enable all standard features (Library, Version, Testing)
  --force     Overwrite existing files (and enforce script standards)
  --dry-run   Simulate the process without making changes
  --help      Show this help message
`);
}
