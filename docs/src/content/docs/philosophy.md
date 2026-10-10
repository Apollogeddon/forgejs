---
title: Philosophy and stack
description: Why Forge.js prioritises compiled tools and centralised configuration.
---

This page explains why Forge.js chose its toolchain and why it centralises configuration. Forge.js is opinionated: it favours fast tools and one shared set of configs over per-project choice.

## Fast tooling

Forge.js prefers tools written in compiled languages (Rust, Go) over pure JavaScript implementations, to shorten CI runs and local feedback loops.

- **Biome:** Written in Rust, Biome lints, formats and organises imports in a single pass. It replaces ESLint and Prettier with one dependency.
- **tsdown and Rolldown:** tsdown bundles with Rolldown (written in Rust), which builds faster than Rollup- or Webpack-based setups.
- **Lefthook:** Written in Go, Lefthook runs Git hook commands in parallel and adds little latency to Git operations compared with Node.js-based alternatives.

## Centralised configuration

Forge.js keeps configuration in one package to prevent drift between repositories. An improvement to the shared configs reaches every project through a single dependency update.

- **One toolchain:** The Biome, TypeScript, Vitest, tsdown and commitlint configs are shared base configs, and every project gets the same Lefthook hooks, so standards stay consistent across an organisation.
- **Vitest:** Chosen for its native ESM support and Vite integration, which avoid the transform configuration Jest often needs.
- **release-please:** Automates releases. Version numbers and changelogs come from the commit history, with no manual steps.
- **Shared CI/CD:** Reusable GitHub Actions workflows give every project the same security scans, quality checks and deployment steps.
- **Tested end to end:** Before each version is published, CI scaffolds a backend, a library and a website, installs them with npm, and runs their generated scripts.

## The toolchain

| Tool | Why | Replaces |
| :--- | :--- | :--- |
| **Biome** | Execution speed and single-dependency architecture. | ESLint, Prettier |
| **tsdown** | Zero-config bundling for TypeScript using Rolldown. | Webpack, Rollup, Babel, TSC (emit) |
| **Vitest** | Native ESM support and shared configuration with Vite. | Jest, Mocha |
| **Lefthook** | Parallel execution and low overhead (Go-based). | Husky, lint-staged |
| **release-please** | Deterministic versioning and changelog generation. | Manual tagging, manual changelogs |
| **commitlint** | Enforces structured commit history for automation. | Manual review of commit messages |
| **Publint** | Validates package exports for compatibility. | Manual verification of entry points |
| **Snodeb** | Debian packaging for Node.js services. | pkg, nexe (for system distribution) |
