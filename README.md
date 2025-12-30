<br />
<div align="center">
  <a href="https://apollogeddon.github.io/forgejs">
    <img src="public/forgejs.png" alt="Logo" width="100" height="100">
  </a>

  <h3 align="center">Forge.js</h3>

  <p align="center">
    DevOps Support and Quality Control for modern Node.js projects
    <br />
    <a href="https://apollogeddon.github.io/forgejs"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://apollogeddon.github.io/forgejs/overview/">Getting Started</a>
    &middot;
    <a href="https://apollogeddon.github.io/forgejs/overview/configuration/">Configuration</a>
    &middot;
    <a href="https://apollogeddon.github.io/forgejs/reference/workflows/">Workflows</a>
  </p>
</div>

<br />

## 📦 Installation

Install the package as a development dependency:

```bash
npm install --save-dev @apollogeddon/forgejs
```

## 🏁 Getting Started

To quickly set up your project with the recommended configurations, scripts, and CI workflows, use the `init` command:

```bash
npx @apollogeddon/forgejs init
```

This command will:

* **Scaffold Configs:** Create `biome.json`, `vitest.config.ts`, `tsconfig.json`, `tsup.config.ts`, and `lefthook.yml`.
* **Inject Scripts:** Add `watch`, `start`, `lint`, `test`, `build`, and `docs` to your `package.json`.
* **Standardize:** Ensure `type: "module"` is set and development standards are enforced.

## ⚙️ Standardized Stack

Forge.js enforces a "Gold Standard" stack designed for performance and reliability:

| Category | Tool | Description |
| :--- | :--- | :--- |
| **Linting & Formatting** | [Biome](https://biomejs.dev/) | High-performance replacement for ESLint & Prettier. |
| **Testing** | [Vitest](https://vitest.dev/) | Vite-native testing framework with instant HMR. |
| **Bundling** | [Tsup](https://tsup.egoist.dev/) | Zero-config TypeScript bundler powered by esbuild. |
| **Documentation** | [Starlight](https://starlight.astro.build/) | Documentation site built with Astro & TypeDoc. |
| **Git Hooks** | [Lefthook](https://github.com/evilmartians/lefthook) | Fast and flexible Git hooks manager. |
| **Commits** | [Commitlint](https://commitlint.js.org/) | Enforces Conventional Commits standards. |
| **Releases** | [Semantic Release](https://github.com/semantic-release/semantic-release) | Fully automated version management and package publishing. |
| **CI/CD** | [GitHub Actions](https://github.com/features/actions) | Reusable workflows for Testing, Quality, and Releases. |
