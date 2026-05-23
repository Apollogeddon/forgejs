<br />
<div align="center">
  <a href="https://apollogeddon.github.io/forgejs">
    <img src="public/forgejs.png" alt="Logo" width="100" height="100">
  </a>

  <h3 align="center">Forge.js</h3>

  <p align="center">
    DevOps Support and Quality Control for modern Node.js projects
    <br />
    <a href="docs/index.md"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="docs/overview/getting-started.md">Getting Started</a>
    &middot;
    <a href="docs/overview/configuration.md">Configuration</a>
    &middot;
    <a href="docs/reference/workflows/index.md">Workflows</a>
  </p>
</div>

<br />

## 📦 Installation

Install the package as a development dependency:

```bash
npm install --save-dev @apollogeddon/forgejs
```

## 🏁 Getting Started

To quickly set up your project with the recommended configurations, scripts, and CI workflows, use the `init` command.

```bash
npx @apollogeddon/forgejs init [options]
```

By default, this sets up a **Node.js Backend/Service**. You can specify other modes:

*   `--backend` (Default) for Node.js services.
*   `--library` for TypeScript libraries.
*   `--website` for Frontend applications (Vite/Astro).

This command will:

*   **Scaffold Configs:** Create `biome.json`, `vitest.config.ts`, `tsconfig.json`, and others depending on the mode (e.g., `tsup.config.ts` or `vite.config.ts`).
*   **Inject Scripts:** Add `watch`, `start`, `lint`, `test`, and `build` to your `package.json`.
*   **Standardise:** Ensure `type: "module"` is set and development standards are enforced.

## ⚙️ Standardised Stack

Forge.js enforces a "Gold Standard" stack designed for performance and reliability:

| Category | Tool | Description |
| :--- | :--- | :--- |
| **Linting & Formatting** | [Biome](https://biomejs.dev/) | High-performance replacement for ESLint & Prettier. |
| **Security Scanning** | [OSV-Scanner](https://osv.dev/) | Google's vulnerability scanner for open source dependencies. |
| **Testing** | [Vitest](https://vitest.dev/) | Vite-native testing framework with instant HMR. |
| **Bundling** | [Tsup](https://tsup.egoist.dev/) | Zero-config TypeScript bundler powered by esbuild. |
| **Git Hooks** | [Lefthook](https://github.com/evilmartians/lefthook) | Fast and flexible Git hooks manager. |
| **Commits** | [Commitlint](https://commitlint.js.org/) | Enforces Conventional Commits standards. |
| **Releases** | [Release Please](https://github.com/googleapis/release-please) | Automated versioning and changelogs via GitHub Actions. |
| **CI/CD** | [GitHub Actions](https://github.com/features/actions) | Reusable workflows for Testing, Quality, and Releases. |

## 🔄 Tooling & Versioning Strategy

Forge.js adopts an opinionated "batteries-included" approach.

* **Managed Versions:** This package manages the versions of core tools (Biome, Vitest, Tsup, OSV-Scanner) as dependencies.
* **Simplified Upgrades:** To upgrade your linter or test runner, simply upgrade `@apollogeddon/forgejs`.
* **Security First:** We integrate security scanning into the standard workflow to catch vulnerabilities early.
* **Stability:** We ensure that all tools in the stack work harmoniously together before releasing a new version.
