---
title: Contributing
description: Quality control tools and commit conventions for contributing to Forge.js.
---

This repository utilizes a strict set of tools to ensure code quality and standardise the development experience.

> **Note**
> This project utilises a `.editorconfig` file. Ensure the IDE is configured to respect these settings (indentation, line endings, etc.) to maintain consistency across the codebase.

## Development Setup

```bash
git clone https://github.com/Apollogeddon/forgejs
cd forgejs
npm install
```

`npm install` also installs the Lefthook Git hooks. Installing `@apollogeddon` packages needs a GitHub token with `read:packages` in your `.npmrc`.

## Quality Control Tools

| Script | What it runs |
| :--- | :--- |
| `npm run lint` | Biome lint and format with fixes |
| `npm run type` | TypeScript type checking |
| `npm run test` | The full Vitest suite, including the end-to-end tests |
| `npm run test:unit` | Unit tests only — dot reporter, no coverage, skips the end-to-end tests |
| `npm run publint` | Package export validation |

Run `lint`, `type` and `test` before opening a pull request.

> **Note**
> The end-to-end tests (`tests/integration.test.ts`) scaffold real projects, run `npm install`, and execute every generated script. They are the only tests that catch wiring bugs such as a config extending a path nothing installs, so run the full `npm run test` for changes to templates, dependencies or the shared configs.

## Documentation

This site lives in `docs/` as its own npm project, built with Astro:

```bash
cd docs
npm install
npm run dev     # live preview at http://localhost:4321/forgejs/
```

## Conventional Commits

The project adheres to the [Conventional Commits](https://www.conventionalcommits.org/) specification. This format is required for the automated release pipeline to function correctly.

### Commit Types

1. **Features** (`feat`) — Triggers a **minor** release.
   Example: `feat: add new biome config`

2. **Fixes** (`fix`) — Triggers a **patch** release.
   Example: `fix: update dependency version`

3. **Maintenance** (`chore`) — Does **not** trigger a release.
   Example: `chore: update readme`

> **Breaking Changes**
> Must include `BREAKING CHANGE:` in the footer or a `!` after the type/scope (e.g., `feat!: rewrite auth logic`) to trigger a **major** release.
