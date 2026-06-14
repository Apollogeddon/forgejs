---
title: Getting Started
description: Install Forge.js and bootstrap a project with the init CLI.
---

Forge.js provides **tooling configurations** and **GitHub Actions workflows** for TypeScript and Node.js projects.

## Requirements

- **Node.js** >= 22

## Setup Guide

### 1. Installation

Install the package as a dev dependency:

```bash
npm install --save-dev @apollogeddon/forgejs
```

### 2. Initialisation

Use the included CLI to bootstrap the project with recommended configurations.

```bash
npx @apollogeddon/forgejs init
```

The command performs the following actions:

- Creates configuration files (`biome.json`, `vitest.config.ts`, `lefthook.yml`, `tsconfig.json`, etc.) if absent.
- Sets `type: "module"` in `package.json`.
- Injects standard scripts into `package.json`.

### 3. Advanced: Overwriting Files

To overwrite existing configuration files with the library defaults, use the `--force` flag:

```bash
npx @apollogeddon/forgejs init --force
```

## Injected Scripts

Scripts vary by mode. The following are injected for **backend** and **library** modes:

| Script | Command | Description |
| :--- | :--- | :--- |
| `lint` | `biome check --fix` | Lints and formats code with Biome. |
| `security` | `osv-scanner scan -r .` | Scans for known vulnerabilities. |
| `type` | `tsc --noEmit` | Runs TypeScript type checking. |
| `watch` | `tsx watch src/index.ts` | Watches source for changes during development. |
| `start` | `node dist/index.js` | Runs the compiled application. |
| `build` | `tsup` | Bundles the project with Tsup. |
| `test` | `vitest run` | Runs unit tests once. |
| `prepare` | `lefthook install` | Installs Git hooks. |

**Library mode** additionally injects:

| Script | Command | Description |
| :--- | :--- | :--- |
| `publint` | `publint` | Validates package exports for compatibility. |

**Website mode** replaces the build/run scripts with:

| Script | Command | Description |
| :--- | :--- | :--- |
| `dev` | `vite` | Starts the Vite development server. |
| `build` | `vite build` | Builds for production. |
| `preview` | `vite preview` | Previews the production build. |

**Optional scripts** injected by feature flags:

| Script | Flag | Command |
| :--- | :--- | :--- |
| `docker:build` | `--docker` | `docker build -t {name} .` |
| `docker:run` | `--docker` | `docker run -p 3000:3000 {name}` |
| `build:deb` | `--debian` | `snodeb` |

## CLI Options

```text
Usage: npx @apollogeddon/forgejs init [options]

Modes (Default is --backend):
  --backend   Setup for Node.js backend/service [Default]
  --library   Setup for TypeScript library
  --website   Setup for Frontend website (Vite/Astro)

Standard Features (Enabled by default):
  --testing   Setup Testing (vitest)
  --version   Setup Versioning (commitlint)
  --linting   Setup Linting & Formatting (biome, lefthook)

Optional Features:
  --docker    Setup Docker configuration
  --debian    Setup Debian packaging (snodeb)

Options:
  --all       Enable all standard features [Default]
  --force     Overwrite existing files (and enforce script standards)
  --dry-run   Simulate the process without making changes
  --help      Show this help message
```

**Validation rules:**

- Only one mode may be active at a time.
- `--docker` and `--debian` are not available in `--library` mode.
- `--debian` is not available in `--website` mode.

## Project Structure

A standard backend project adheres to the following structure:

```text
.github/
  workflows/
    index.yml
src/
  index.ts
tests/
  index.test.ts
biome.json
commitlint.config.ts
lefthook.yml
package.json
tsconfig.json
tsup.config.ts
vitest.config.ts
```
