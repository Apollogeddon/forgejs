---
title: Getting Started
description: Install Forge.js and bootstrap a project with the init CLI.
---

Forge.js provides **tooling configurations** and **GitHub Actions workflows** for TypeScript and Node.js projects.

## Requirements

- **Node.js** >= 22
- Access to GitHub Packages, where `@apollogeddon/forgejs` is published — a token with `read:packages` in your `.npmrc`.
- Git, for the generated Lefthook hooks.

## Setup Guide

### 1. Installation

Install the package as a dev dependency:

```bash
npm install --save-dev @apollogeddon/forgejs
```

### 2. Initialisation

Run `init` in an existing project, or in an empty directory to start a new one:

```bash
npx @apollogeddon/forgejs init            # Node.js service/application (default)
npx @apollogeddon/forgejs init --library  # publishable TypeScript library
npx @apollogeddon/forgejs init --website  # frontend website (Vite)
```

Then install dependencies, which also installs the Git hooks through the `prepare` script:

```bash
npm install
```

`init` is safe to re-run. It creates missing files and scripts, sets `type: "module"` in `package.json`, and leaves anything that already exists alone.

### 3. Advanced: Overwriting Files

Pass `--force` to overwrite existing config files and scripts with the Forge.js defaults:

```bash
npx @apollogeddon/forgejs init --force
```

`--force` never touches your own source code: the starter `src/index.ts` (and `index.html` and `src/main.ts` for websites) are only ever created when missing. Use `--dry-run` first to see exactly what would change.

## Injected Scripts

Forge.js adds scripts to `package.json`. Run them with `npm run <script>`.

| Script | Command | Added when |
| :--- | :--- | :--- |
| `lint` | `biome check --fix` | linting on |
| `security` | `osv-scanner scan -r .` | linting on |
| `prepare` | `lefthook install` | linting on |
| `type` | `tsc --noEmit` | always |
| `test` | `vitest run` | testing on |
| `build` | `tsup` (`vite build` for websites) | always |
| `start` | `node dist/index.js` | `--backend`, `--library` |
| `watch` | `tsx watch src/index.ts` | `--backend`, `--library` |
| `publint` | `publint` | `--library` |
| `dev` | `vite` | `--website` |
| `preview` | `vite preview` | `--website` |
| `docker:build` / `docker:run` | `docker build` / `docker run` for the project image | `--docker` |
| `build:deb` | `snodeb` | `--debian` |

Existing scripts with the same name are kept unless you pass `--force`.

## CLI Options

```text
npx @apollogeddon/forgejs init [options]
```

| Option | Description |
| :--- | :--- |
| `--backend` | Node.js service/application (default). |
| `--library` | Publishable TypeScript library. |
| `--website` | Frontend website built with Vite. |
| `--testing` / `--no-testing` | Vitest (default: on). |
| `--linting` / `--no-linting` | Biome + Lefthook (default: on). |
| `--version` / `--no-version` | release-please + commitlint (default: on). |
| `--all` / `--no-all` | Enable or disable every standard feature at once; an explicit flag such as `--testing` still wins. |
| `--docker` | Add a `Dockerfile` and container CI (not available for `--library`). |
| `--debian` | Add Snodeb `.deb` packaging (not available for `--library` or `--website`). |
| `--force` | Overwrite existing config files and scripts. |
| `--dry-run` | Show what would change without writing anything. |
| `--help` | Show the help message. |

`--website` scaffolds a frontend application. For a documentation site, such as one built with Astro, the `website.yml` workflow builds and deploys whatever `npm run build` outputs.

Only one mode may be active at a time. `--no-testing` and `--no-version` also switch off the matching step in the generated CI workflow.

## Project Structure

A default `init` (backend) produces:

```text
.
├── .github/
│   └── workflows/index.yml   # CI/CD calling the reusable workflows
├── src/
│   └── index.ts
├── biome.json                # extends the Forge.js Biome config
├── commitlint.config.ts      # extends the Forge.js commitlint config
├── lefthook.yml
├── package.json              # type: module, scripts, @apollogeddon/forgejs devDependency
├── tsconfig.json             # extends the Forge.js tsconfig
├── tsup.config.ts            # extends the Forge.js Tsup config
└── vitest.config.ts          # merges the Forge.js Vitest config
```

`--website` replaces `tsup.config.ts` with `vite.config.ts` and adds `index.html` and `src/main.ts`. `--docker` adds `Dockerfile` and `.dockerignore`, and `--debian` adds `snodeb.config.cjs`.
