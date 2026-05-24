# Getting Started

Forge.js provides **tooling configurations** and **GitHub Actions workflows** for TypeScript and Node.js projects.

## Setup Guide

**1. Installation**

Install the package as a dev dependency:

```bash
npm install --save-dev @apollogeddon/forgejs
```

**2. Initialisation**

Use the included CLI to bootstrap the project with recommended configurations.

```bash
npx @apollogeddon/forgejs init
```

The command performs the following actions:

- Creates configuration files (e.g., `biome.json`, `vitest.config.ts`, `lefthook.yml`) if absent.
- Sets `type: "module"` in `package.json`.
- Injects standard scripts (`lint`, `test`, `build`, etc.) into `package.json`.

The following scripts are added:

| Script | Command | Description |
| :--- | :--- | :--- |
| `lint` | `biome check --fix` | Runs Biome to lint and format code. |
| `type` | `tsc --noEmit` | Runs TypeScript type checking. |
| `build` | `tsup` | Builds the project using Tsup. |
| `test` | `vitest run` | Runs unit tests once. |
| `publint` | `publint` | Checks package compatibility. |
| `prepare` | `lefthook install` | Installs Git hooks. |

**3. Advanced: Overwriting Files**

To overwrite existing configuration files with the library defaults, use the `--force` flag:

```bash
npx @apollogeddon/forgejs init --force
```

## CLI Options

```
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
```

## Project Structure

A standard project utilising this library adheres to the following structure:

```
.github/
  workflows/
    ci.yml
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
