---
title: Getting started
description: Install Forge.js and set up a project with the init command.
---

Forge.js sets up TypeScript and Node.js projects with a standard toolchain and a GitHub Actions pipeline. This page covers installing it, running `init`, and what `init` generates.

## Requirements

- Node.js 22 or later.
- Git, for the generated Lefthook hooks.
- A GitHub token with the `read:packages` scope. `@apollogeddon/forgejs` is published to GitHub Packages, not the public npm registry.

## Install

Point the `@apollogeddon` scope at GitHub Packages in your project's `.npmrc`. Keep the token in your user-level `~/.npmrc` or the environment, not in the repository:

```ini
@apollogeddon:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Install the package as a development dependency:

```bash
npm install --save-dev @apollogeddon/forgejs
```

## Initialise a project

Run `init` in an existing project, or in an empty directory to start a new one. Pick one mode:

```bash
# Node.js service or application (default)
npx @apollogeddon/forgejs init

# Publishable TypeScript library
npx @apollogeddon/forgejs init --library

# Frontend website built with Vite
npx @apollogeddon/forgejs init --website
```

Then install dependencies. This also installs the Git hooks through the `prepare` script:

```bash
npm install
```

You can re-run `init` safely. It creates missing files and scripts and keeps existing ones. It always sets `"type": "module"` in `package.json`, sets `"private": true` for backends and websites, and points `main` and `types` at `dist/` for backends and libraries.

### Overwrite existing files

Pass `--force` to replace existing config files, scripts and the `@apollogeddon/forgejs` dependency version with the Forge.js defaults:

```bash
npx @apollogeddon/forgejs init --force
```

`--force` also deletes config files for features that are off in that run. For example, `init --force` without `--docker` removes an existing `Dockerfile` and `.dockerignore`, and `--no-testing --force` removes `vitest.config.ts`. Without `--force`, `init` only warns about these files.

`--force` never touches your own source code: the starter `src/index.ts` (and `index.html` and `src/main.ts` for websites) is only created when missing. Run with `--dry-run` first to see what would change.

## CLI options

```text
npx @apollogeddon/forgejs init [options]
```

| Option | Description |
| :--- | :--- |
| `--backend` | Node.js service or application. The default when no mode is given. |
| `--library` | Publishable TypeScript library. |
| `--website` | Frontend website built with Vite. |
| `--testing`, `--no-testing` | Vitest. On by default. |
| `--linting`, `--no-linting` | Biome and Lefthook. On by default. |
| `--version`, `--no-version` | release-please and commitlint. On by default. |
| `--all`, `--no-all` | Turn every standard feature on or off. An explicit flag such as `--testing` still wins. |
| `--docker` | Add a `Dockerfile` and a container build in CI. Not available with `--library`. |
| `--debian` | Add Snodeb `.deb` packaging. Not available with `--library` or `--website`. |
| `--force` | Overwrite existing config files and scripts, and remove config files for disabled features. |
| `--dry-run` | Show what would change without writing anything. |
| `--help` | Show the help message. |

Only one mode can be active at a time. `--no-testing` and `--no-version` also turn off the matching jobs in the generated CI workflow.

`--no-all` turns off the standard features, not the mode: without a mode flag the project is still a `--backend` project, with its CI workflow.

`--website` scaffolds a frontend application built with Vite: `index.html`, `src/main.ts` and `vite.config.ts`, with `dev`, `build` and `preview` scripts. Run `npm run dev` to work on it locally. In CI, the `website.yml` workflow builds the site and deploys `dist/` to GitHub Pages. It deploys whatever `npm run build` writes to `dist/`, so a site built with another tool, such as Astro, deploys the same way.

## Generated scripts

`init` adds these scripts to `package.json`. Run them with `npm run <script>`.

| Script | Command | Added when |
| :--- | :--- | :--- |
| `lint` | `biome check --fix` | Linting is on |
| `security` | `osv-scanner scan -r .` (needs `osv-scanner` on your `PATH`) | Linting is on |
| `prepare` | `lefthook install` | Linting is on |
| `type` | `tsc --noEmit` | Always |
| `test` | `vitest run` | Testing is on |
| `build` | `tsup`, or `vite build` for websites | Always |
| `start` | `node dist/index.js` | `--backend`, `--library` |
| `watch` | `tsx watch src/index.ts` | `--backend`, `--library` |
| `publint` | `publint` | `--library` |
| `dev` | `vite` | `--website` |
| `preview` | `vite preview` | `--website` |
| `docker:build`, `docker:run` | `docker build` and `docker run` for the project image | `--docker` |
| `build:deb` | `snodeb` | `--debian` |

Existing scripts with the same name are kept unless you pass `--force`.

## Project structure

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

## Next steps

- [Configuration](/forgejs/docs/configuration) explains how to override the shared configs.
- [Workflows](/forgejs/docs/workflows/overview) describes the generated CI pipeline and its inputs.
