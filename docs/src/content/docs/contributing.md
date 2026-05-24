---
title: Contributing
description: Quality control tools and commit conventions for contributing to Forge.js.
---

This repository utilizes a strict set of tools to ensure code quality and standardise the development experience.

> **Note**
> This project utilises a `.editorconfig` file. Ensure the IDE is configured to respect these settings (indentation, line endings, etc.) to maintain consistency across the codebase.

## Quality Control Tools

The project relies on several tools to maintain quality standards:

- **Lefthook**: Manages Git hooks to run checks before commits.
- **Commitlint**: Ensures commit messages follow the Conventional Commits specification.
- **Biome**: Handles linting and formatting.
- **Publint**: Validates package integrity and exports before release.

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
