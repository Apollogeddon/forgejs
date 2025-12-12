# Node.js DevOps Templates & Configurations

A centralised library of **reusable GitHub Actions workflows** and **standardised tooling configurations** designed to streamline DevOps for TypeScript and Node.js projects.

This package allows you to maintain consistent quality, testing, and release standards across multiple repositories without duplicating boilerplate code.

## 📦 Installation

Install the package as a development dependency:

```bash
npm install --save-dev @apollogeddon/forgejs
```

## 🤝 Contributing

This repository uses **Lefthook**, **Commitlint**, **Biome**, and **Publint** to ensure code quality, standardise commit messages, and validate package integrity. We also utilise a `.editorconfig` file to maintain consistent coding styles across different editors.

### EditorConfig

Please ensure your IDE/editor is configured to respect `.editorconfig` settings (e.g., indentation, line endings). Most modern editors have built-in support or plugins for this.

### Conventional Commits

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification. This is required for our automated releases to function correctly.

Examples:

* `feat: add new biome config` (Triggers minor release)
* `fix: update dependency version` (Triggers patch release)
* `chore: update readme` (No release)

## 🏁 Getting Started

1. **Install the library** (see above).
2. **Create a workflow file** (e.g., `.github/workflows/ci.yml`):

   ```yaml
   name: CI
   on: [push]
   jobs:
     test:
       uses: apollogeddon/forgejs/.github/workflows/testing.yml@main
   ```

3. **Extend configurations** in your project files (see below).

### Initialising Your Project

To quickly set up your project with the recommended configurations and scripts, use the `init` command:

```bash
npx @apollogeddon/forgejs init
```

This command will:

* Create standard configuration files (e.g., `biome.json`, `vitest.config.ts`, `lefthook.yml`, etc.) if they don't already exist.
* If a `package.json` file is present, it will:
  * Ensure `type: "module"` is set.
  * Add recommended scripts (`lint`, `type`, `build`, `test`, `publint`, `prepare`) to your `package.json`, merging with existing ones.
* If `package.json` is not present, it will create a basic one with the above settings.

**Overwriting Existing Files:**

If you need to overwrite existing configuration files with the defaults from this library, use the `--force` flag:

```bash
npx @apollogeddon/forgejs init --force
```

## 📂 Recommended Project Structure

Here is how a standard project using this library should look:

```text
my-project/
├── .github/
│   └── workflows/
│       └── index.yml          # Imports workflows from this library
├── src/
│   └── index.ts               # Source code
├── tests/
│   └── index.test.ts          # Unit Tests
├── .editorconfig              # Editor style settings
├── .releaserc.json            # Semantic Release config
├── biome.json                 # Linter/Formatter config
├── commitlint.config.ts       # Commit linter config
├── lefthook.yml               # Git hooks config
├── package.json               # Dependencies & scripts
├── snodeb.config.ts           # Debian package config (optional)
├── tsconfig.json              # TypeScript config
├── tsdown.config.ts           # Build/Bundler config
├── typedoc.json               # Documentation generator config
└── vitest.config.ts           # Test runner config
```

## ⚙️ Shared Configurations

This library exports "gold standard" configurations for common tools. You can extend these in your project to inherit best practices.

## 🚀 Reusable Workflows

This repository provides modular GitHub Actions workflows to handle CI/CD pipelines.

For detailed documentation on available workflows, architecture, and usage examples, please see the **[Workflow Documentation](.github/WORKFLOWS.md)**.

## Config File Examples

### Biome (Linting & Formatting)

Extend the shared Biome configuration in your `biome.json`:

```json
{
  "extends": ["node_modules/@apollogeddon/forgejs/biome.json"]
}
```

### Vitest (Testing)

Import and merge the base configuration in your `vitest.config.ts`:

```ts
import { mergeConfig } from 'vitest/config';
import baseConfig from '@apollogeddon/forgejs/vitest.config.cjs';

export default mergeConfig(baseConfig, {
  test: {
    // Project-specific overrides
  }
});
```

### Semantic Release

Inherit the release rules in your `.releaserc.json`:

```json
{
  "extends": "@apollogeddon/forgejs/.releaserc.json"
}
```

*For Helm chart projects, use `"extends": "@apollogeddon/forgejs/.releaserc.helm.json"` instead.*

### TypeDoc

Extend the documentation generator config in `typedoc.json`:

```json
{
  "extends": "@apollogeddon/forgejs/typedoc.json"
}
```

### Commitlint

Extend the shared commitlint configuration in your `commitlint.config.js`:

```js
import type { UserConfig } from '@commitlint/types';
import baseConfig from '@apollogeddon/forgejs/commitlint.config.ts';

const Configuration: UserConfig = {
  extends: [baseConfig.extends],
  // Add project-specific rules here
};

export default Configuration;
```

### Lefthook (Git Hooks)

To use the shared Lefthook configuration, copy it into your project's root directory:

```bash
cp node_modules/@apollogeddon/forgejs/lefthook.yml ./lefthook.yml
npx lefthook install # Install the git hooks
```

### Tsdown (TypeScript Down-compiler)

Import the base configuration and override properties in your `tsdown.config.ts`:

```ts
import { defineConfig } from "tsdown";
import baseConfig from "@apollogeddon/forgejs/tsdown.config.ts";

export default defineConfig({
  ...baseConfig,
  // Override or add project-specific properties here
  entry: ["./src/your-entry-file.ts"],
});
```

### Snodeb (Node.js Debian Packaging)

Import the base configuration and override properties in your `snodeb.config.ts`:

```ts
import { defineSnodebConfig } from "snodeb";
import baseConfig from "@apollogeddon/forgejs/snodeb.config.ts";

export default defineSnodebConfig({
  ...baseConfig,
  // Override or add project-specific properties here
  files: {
    ...baseConfig.files,
    include: ["dist/**/*.js"], // Example override
  },
});
```
