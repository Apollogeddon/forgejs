# Workflow Job Reference

This reference details the execution flow and responsibility of each job within the workflow ecosystem.

## Pipeline Lifecycle

The workflows follow a modular design. The logical progression from code change to production release is:

1. **Quality Assurance** — Runs quality checks on every push using `quality.yml` and `testing.yml`.
2. **Build & Artifacts** — Upon successful quality checks, `build.yml` compiles source code into a redistributable format.
3. **Versioning** — `version.yml` calculates the next semantic version and prepares release notes.
4. **Delivery** — `library.yml` (NPM) or `debian.yml` (Linux) publishes the artifacts to registries.

---

## default.yml

*The foundation. These jobs provide the environment used by all other pipelines.*

- **`setup`** — Prepares Node.js, caches dependencies, performs a clean install (`npm ci`), and runs a high-level security audit.
- **`auto-merge`** — Automatically merges Dependabot pull requests for minor and patch updates to maintain dependency freshness.

## quality.yml

*Ensures code standards are maintained before further processing.*

1. Calls → `default.yml` to prepare Node.js and dependencies.
2. **`check`** — Executes Biome linting and TypeScript type checking sequentially. *(Needs: setup)*

## testing.yml

*Validates logic correctness.*

1. Calls → `quality.yml` to ensure linting and types are correct before starting tests.
2. **`test`** — Runs the full Vitest suite and uploads code coverage reports. *(Needs: quality)*

## build.yml

*Compiles source code into production-ready assets.*

1. Calls → `default.yml` to prepare the environment.
2. **`build`** — Bundles the project using Tsup and uploads the resulting `dist` directory. *(Needs: setup)*

## version.yml

*Manages the release process.*

1. Calls → `build.yml` to ensure the project compiles before attempting a release.
2. **`version`** — Analyzes commits, determines versioning, and creates a GitHub Release. *(Needs: build)*

## library.yml

*Orchestrates NPM publishing.*

1. Calls → `version.yml` to trigger the build and versioning logic.
2. **`publish`** — Publishes the package to NPM or GitHub Packages with OIDC-based provenance. *(Needs: version)*

## debian.yml

*Orchestrates Linux packaging.*

1. Calls → `version.yml` to trigger the build and versioning logic.
2. **`build`** — Converts build artifacts into a `.deb` installer using Snodeb and uploads the package. *(Needs: version)*
