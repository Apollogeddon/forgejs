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

Forge.js (`@apollogeddon/forgejs`) is a project-scaffolding CLI for TypeScript and Node.js. Its `init` command sets up a backend, library or website with a standard toolchain and a GitHub Actions pipeline built from reusable workflows. It keeps your lint, type-check and test setup in one place: the generated configs extend base configs shipped in the package, so upgrading the package upgrades every project.

## Requirements

- Node.js
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

- Creates, depending on the mode and flags, `tsconfig.json`, `biome.json`, `vitest.config.ts`, `lefthook.yml`, `commitlint.config.ts`, a build config (`tsdown.config.ts` or `vite.config.ts`), a `.github/workflows/.index.yml` that calls the reusable pipelines, and the repository files `.editorconfig`, `.github/dependabot.yml` and `.github/CODEOWNERS`.
- Adds scripts such as `lint`, `type`, `test` and `build` to `package.json`, sets `"type": "module"`, and adds `@apollogeddon/forgejs` as a `devDependency`.
- Creates a starter `src/index.ts` (or `index.html` and `src/main.ts` for websites) if none exists.

Existing files and scripts are kept unless you pass `--force`. Preview changes with `--dry-run`. See [Getting started](https://apollogeddon.github.io/forgejs/docs/getting-started) for every flag and script.

## Keeping projects up to date

The generated `biome.json`, `tsconfig.json` and other configs extend the base configs shipped in `@apollogeddon/forgejs/configs/`, so upgrading the package upgrades the tools and their configuration in one step:

```bash
npm install --save-dev @apollogeddon/forgejs@latest
```

The generated `.github/workflows/.index.yml` calls forgejs's pipelines at the release that wrote it, such as `@v7.0.0`; Dependabot proposes the next release's tag as a GitHub Actions update.

## Documentation

The full documentation is at [apollogeddon.github.io/forgejs](https://apollogeddon.github.io/forgejs):

- [Getting started](https://apollogeddon.github.io/forgejs/docs/getting-started): requirements, CLI flags and generated scripts.
- [Configuration](https://apollogeddon.github.io/forgejs/docs/configuration): the files Forge.js writes and how to change them.
- [Examples](https://apollogeddon.github.io/forgejs/docs/examples): common configuration and workflow recipes.
- [Workflows](https://apollogeddon.github.io/forgejs/docs/workflows/overview): the reusable GitHub Actions pipelines and their inputs.
- [Migration](https://apollogeddon.github.io/forgejs/docs/migration): adopting Forge.js in a project that already has tooling.

## Contributing

Pull requests are welcome. The [contributing guide](https://apollogeddon.github.io/forgejs/docs/contributing) covers setting up the repository, the checks to run before opening a pull request, and the commit message format releases are generated from.

## License

Forge.js is released under the [MIT License](LICENSE).
