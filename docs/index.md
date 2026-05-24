# Forge.js

> Reusable GitHub Actions workflows and tooling configurations for TypeScript and Node.js.

## Project Overview

Forge.js centralises configuration management for Node.js projects. It consolidates build, test, linting, and release settings into a single installable package, reducing the need for maintenance of individual dotfiles across repositories.

- **Standardised Tooling** — Provides default configurations for Biome, Vitest, and Tsup to enforce consistency across multiple projects.
- **Reusable Workflows** — Exports modular GitHub Actions workflows for testing, building, and releasing packages, eliminating manual YAML authoring.
- **Project Scaffolding** — Includes a CLI tool to bootstrap new repositories with the `init` command. Supports modular setup for libraries, Debian packages, and more.

  ```bash
  npx @apollogeddon/forgejs init [options]
  ```

- **Automated Releases** — Implements Semantic Release pipelines for automated versioning, changelog generation, and package publishing.

## Tech Stack

| Tool | Role |
| :--- | :--- |
| **Biome** | High-performance linting and formatting (Rust-based). Replaces ESLint and Prettier. |
| **Tsup** | Zero-config TypeScript bundler powered by esbuild. |
| **Vitest** | Vite-native unit test framework with ESM support and coverage reporting. |
| **Semantic Release** | Automated version management based on conventional commit history. |
| **Lefthook** | Git hooks manager for enforcing quality checks locally. |
| **Commitlint** | Validator for Conventional Commits specification adherence. |
| **Publint** | Validator for `package.json` exports and compatibility. |
| **Snodeb** | Debian package generator for Node.js applications. |

## Documentation

- [Getting Started](overview/getting-started.md)
- [Configuration](overview/configuration.md)
- [Philosophy & Stack](overview/philosophy.md)
- [Contributing](overview/contributing.md)
- [Migrating to Forge.js](overview/migration.md)
- [Examples](reference/examples.md)
- [Workflows Overview](reference/workflows/index.md)
- [Workflow Job Reference](reference/workflows/reference.md)
