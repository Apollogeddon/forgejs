<br />
<div align="center">
  <a href="https://apollogeddon.github.io/forgejs">
    <img src="docs/public/forgejs.svg" alt="Logo" width="100" height="100">
  </a>

  <h3 align="center">Forge.js</h3>

  <p align="center">
    Reusable GitHub Actions workflows and tooling configurations for TypeScript and Node.js projects
    <br />
    <a href="https://apollogeddon.github.io/forgejs"><strong>Read the docs</strong></a>
    <br />
    <br />
    <a href="https://apollogeddon.github.io/forgejs/docs/getting-started">Getting started</a>
    &middot;
    <a href="https://apollogeddon.github.io/forgejs/docs/configuration">Configuration</a>
    &middot;
    <a href="https://apollogeddon.github.io/forgejs/docs/workflows/overview">Workflows</a>
  </p>
</div>

<br />

Forge.js (`@apollogeddon/forgejs`) is a project-scaffolding CLI for TypeScript and Node.js. Its `init` command sets up a backend, library or website with a standard toolchain (Biome, Vitest, Tsup or Vite, Lefthook, commitlint, release-please) and a GitHub Actions pipeline built from reusable workflows. It keeps your Biome, TypeScript and Vitest setup in one place: the generated configs extend base configs shipped in the package, so upgrading one dependency upgrades every project.

## Requirements

- Node.js 22 or later
- Git, for the generated Lefthook hooks
- A GitHub token with the `read:packages` scope: the package is published to GitHub Packages, not the public npm registry

## Installation

Point the `@apollogeddon` scope at GitHub Packages in your project's `.npmrc`, and keep the token itself in your user-level `~/.npmrc` or the environment:

```ini
@apollogeddon:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Then install the package as a development dependency:

```bash
npm install --save-dev @apollogeddon/forgejs
```

## Quick start

Run `init` in an existing project, or in an empty directory to start a new one, then install the dependencies it adds:

```bash
npx @apollogeddon/forgejs init
npm install
```

`init` sets up a Node.js backend service by default. Choose another mode with a flag:

| Flag | Project type |
| :--- | :--- |
| `--backend` | Node.js service or application (default) |
| `--library` | Publishable TypeScript library |
| `--website` | Frontend website built with Vite |

`init` then:

- Creates, depending on the mode and flags, `tsconfig.json`, `biome.json`, `vitest.config.ts`, `lefthook.yml`, `commitlint.config.ts`, a build config (`tsup.config.ts` or `vite.config.ts`) and a `.github/workflows/index.yml` that calls the reusable workflows.
- Adds scripts such as `lint`, `type`, `test` and `build` to `package.json`, sets `"type": "module"`, and adds `@apollogeddon/forgejs` as a `devDependency`.
- Creates a starter `src/index.ts` (or `index.html` and `src/main.ts` for websites) if none exists.

Existing files and scripts are kept unless you pass `--force`. Preview changes with `--dry-run`. See [Getting started](https://apollogeddon.github.io/forgejs/docs/getting-started) for every flag and script.

## The toolchain

| Category | Tool |
| :--- | :--- |
| Linting and formatting | [Biome](https://biomejs.dev/) |
| Dependency scanning | [OSV-Scanner](https://osv.dev/) |
| Secret scanning (CI) | [Gitleaks](https://github.com/gitleaks/gitleaks) |
| Testing | [Vitest](https://vitest.dev/) |
| Bundling | [Tsup](https://tsup.egoist.dev/) for backends and libraries, [Vite](https://vite.dev/) for websites |
| Git hooks | [Lefthook](https://github.com/evilmartians/lefthook) |
| Commit messages | [commitlint](https://commitlint.js.org/) with Conventional Commits |
| Releases | [release-please](https://github.com/googleapis/release-please) |
| Containers (`--docker`) | Multi-platform [Docker Buildx](https://docs.docker.com/build/) images, pushed to GitHub Container Registry on release |
| Debian packages (`--debian`) | [Snodeb](https://www.npmjs.com/package/snodeb) |

OSV-Scanner is not an npm package: CI downloads it, and the local `npm run security` script needs `osv-scanner` on your `PATH`.

## Keeping projects up to date

Biome, Vitest, Tsup, Vite, Lefthook, commitlint, Publint and Snodeb are dependencies of `@apollogeddon/forgejs`, so their versions are pinned and tested together. The generated `biome.json`, `tsconfig.json` and other configs extend the base configs shipped in `@apollogeddon/forgejs/configs/`, so upgrading the package upgrades the tools and their configuration in one step:

```bash
npm install --save-dev @apollogeddon/forgejs@latest
```

## Documentation

The full documentation is at [apollogeddon.github.io/forgejs](https://apollogeddon.github.io/forgejs):

- [Getting started](https://apollogeddon.github.io/forgejs/docs/getting-started): requirements, CLI flags and generated scripts.
- [Configuration](https://apollogeddon.github.io/forgejs/docs/configuration): the files Forge.js writes and how to change them.
- [Examples](https://apollogeddon.github.io/forgejs/docs/examples): common configuration and workflow recipes.
- [Workflows](https://apollogeddon.github.io/forgejs/docs/workflows/overview): the reusable GitHub Actions workflows and their inputs.
- [Migration](https://apollogeddon.github.io/forgejs/docs/migration): adopting Forge.js in a project that already has tooling.

## License

Forge.js is released under the [MIT License](LICENSE).
