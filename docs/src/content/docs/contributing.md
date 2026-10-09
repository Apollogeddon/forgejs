---
title: Contributing
description: Set up the Forge.js repository, run its checks, and write commit messages for its release process.
---

This page is for contributors to Forge.js itself: how to set up the repository, which checks to run, and how to write commit messages.

## Development setup

```bash
git clone https://github.com/Apollogeddon/forgejs
cd forgejs
npm install
```

`npm install` also installs the Lefthook Git hooks. The repository includes an `.editorconfig`; configure your editor to respect it.

## Checks

| Script | What it runs |
| :--- | :--- |
| `npm run lint` | Biome lint and format, applying fixes |
| `npm run type` | TypeScript type checking |
| `npm run test` | The full Vitest suite, including the end-to-end tests |
| `npm run test:unit` | Unit tests only, with the dot reporter and no coverage; skips the end-to-end tests |
| `npm run publint` | Package export validation |

Run `lint`, `type` and `test` before opening a pull request.

The end-to-end tests (`tests/integration.test.ts`) scaffold real projects, run `npm install`, and run the generated scripts. They are the only tests that catch wiring bugs, such as a config extending a path nothing installs. Run the full `npm run test` for changes to templates, dependencies or the shared configs. The Docker tests run only when a Docker daemon is available.

## Documentation

This site lives in `docs/` as its own npm project, built with Astro:

```bash
cd docs
npm install
npm run dev
```

The dev server serves a live preview at `http://localhost:4321/forgejs/`.

## Commit messages

Commits follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. commitlint checks each message, and release-please uses them to choose the next version and write the changelog.

| Type | Example | Release |
| :--- | :--- | :--- |
| `feat` | `feat: add new biome config` | Minor |
| `fix` | `fix: update dependency version` | Patch |
| `chore`, `docs`, `ci`, and other types | `docs: update readme` | None |

For a breaking change, add `!` after the type or scope (`feat!: rewrite auth logic`) or a `BREAKING CHANGE:` footer. This triggers a major release.
