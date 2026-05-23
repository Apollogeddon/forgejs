# Philosophy & Stack

Forge.js implements an opinionated toolchain designed to prioritise execution speed and configuration simplicity.

## High-Performance Tooling

The project prioritises tools written in compiled languages (Rust, Go) over pure JavaScript implementations to minimise CI execution time and local feedback loops.

- **Biome:** Written in Rust, Biome combines linting, formatting, and import organisation into a single pass. This replaces the traditional ESLint/Prettier stack, reducing dependency overhead and execution time.
- **Tsup & Esbuild:** Tsup leverages `esbuild` (written in Go) for TypeScript transpilation, offering significantly faster build times compared to Rollup or Webpack-based solutions.
- **Lefthook:** Written in Go, Lefthook executes Git hooks in parallel. It introduces minimal latency to git operations compared to Node.js-based alternatives.

## Standardisation as a Service

Forge.js abstracts configuration to prevent "drift" across repositories. The goal is to ensure that improvements to the build system propagate to all consumers via a single dependency update.

- **Unified Toolchain:** By centralising 15+ configuration files, the library enforces consistent standards across an organization.
- **Vitest:** Selected for its native ESM support and integration with the Vite ecosystem, removing the need for complex transform configurations often required by Jest.
- **Semantic Release:** Automates the release lifecycle. Version numbers and changelogs are derived deterministically from commit history, removing manual intervention from the release process.
- **Centralised CI/CD:** Reusable GitHub Actions workflows ensure consistent security audits, quality gates, and deployment patterns across all projects.

## The Toolchain

| Tool | Why? | Replaces |
| :--- | :--- | :--- |
| **Biome** | Execution speed and single-dependency architecture. | ESLint, Prettier |
| **Tsup** | Zero-config bundling for TypeScript using esbuild. | Webpack, Rollup, Babel, TSC (emit) |
| **Vitest** | Native ESM support and shared configuration with Vite. | Jest, Mocha |
| **Lefthook** | Parallel execution and low overhead (Go-based). | Husky, lint-staged |
| **Semantic Release** | Deterministic versioning and changelog generation. | Manual tagging, manual changelogs |
| **Commitlint** | Enforces structured commit history for automation. | Manual review of commit messages |
| **Publint** | Validates package exports for compatibility. | Manual verification of entry points |
| **Snodeb** | Native Debian packaging for Node.js. | pkg, nexe (for system distribution) |
