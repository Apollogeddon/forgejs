# Migrating to Forge.js

Adopting Forge.js reduces configuration overhead but requires the removal of conflicting tooling configurations.

## Migration Checklist

**1. Run Initialization**

Execute the init command to generate the new standard configurations.

```bash
npx @apollogeddon/forgejs init
```

**2. Remove Old Configs**

Remove configuration files for tools replaced by this library to prevent conflicts.

- **Remove ESLint & Prettier:** `rm .eslintrc* .prettierrc* .eslintignore .prettierignore`
- **Remove Jest:** `rm jest.config.*`
- **Remove Semantic Release (local):** `rm .releaserc` (if replacing with the extended JSON)

**3. Update Dependencies**

Uninstall the tools that are now managed by Forge.js.

```bash
npm uninstall eslint prettier jest ts-jest semantic-release @semantic-release/git @semantic-release/github
```

**4. Fix Linting Errors**

Biome enforces stricter rules than some ESLint configurations. Run the fix command to resolve most issues automatically.

```bash
npm run lint
```

## Tool-Specific Guides

### ESLint/Prettier to Biome

Biome handles both linting and formatting. Configuration is generally not required if extending the default `biome.json`.

> **Tip:** For large codebases with many initial errors, incremental adoption is possible via the `--changed` flag in local workflows, although the CI pipeline enforces compliance on the entire project.

### Jest to Vitest

Vitest is largely API-compatible with Jest, with specific differences:

1. **Globals:** Forge.js configures Vitest with `globals: false` by default. Import `describe`, `it`, `expect`, etc., directly from `vitest` in test files.

   ```ts
   import { describe, it, expect } from 'vitest';
   ```

2. **Environment:** For tests involving DOM interactions, ensure a compatible environment (e.g., `happy-dom` or `jsdom`) is configured.

### Semantic Release

For projects with existing `.releaserc` files, verify if overrides are necessary.
The default configuration assumes:
- Releases occur from the `main` branch.
- A changelog (`CHANGELOG.md`) is generated.
- Packages are published to NPM (or GitHub Packages).
