# Claude Code Instructions

General working rules (subagent routing, tool use, response style) live in the user-level `~/.claude/CLAUDE.md`. This file is project-specific.

## Reading the codebase

`src/` is ~1k lines and `tests/` ~800: read what you need directly rather than delegating. Use an `Explore` agent only for `docs/` (a separate Astro package), `node_modules`. Lockfiles, `coverage/`, `dist/` and `junit-report.xml` are denied to `Read` in `settings.json` — use `npm ls <pkg>` to check a resolved version.

A `PostToolUse` hook (`.claude/hooks/read-counter.cjs`) reminds you past 10 Read/Grep/Glob calls in a session.

## Quality Control

- A `PostToolUse` hook (`.claude/hooks/lint-on-edit.cjs`) runs `biome check --fix` on every `src/**` file touched by `Edit`/`Write`. Errors it can't fix are returned to you — fix them before moving on.
- While iterating, run `npm run test:unit` (dot reporter, no coverage, skips the slow real-`npm install` integration test).
- Before reporting a non-trivial change complete, run `npm run lint && npm run type && npm run test`. Always run the full `npm run test` when a change touches config wiring, dependencies or `extends` paths — only the integration test catches those.
- Run `/code-review` (medium+) on non-trivial diffs before considering them done; use `/simplify` as a cleanup pass afterward.

## Architecture

forgejs is a project-scaffolding CLI: `src/index.ts` parses argv (`node:util` `parseArgs`, strict mode, explicit `--no-<x>` negation flags per standard feature), resolves an `InitConfig` (`src/types.ts`), and calls `init()` in `src/core.ts`.

`core.ts` loads/creates the target project's `package.json`, then runs an ordered **Feature pipeline** (the list is in `src/core.ts`; `src/features/index.ts` re-exports the feature modules): `BaseFeature → LintingFeature → BuildFeature → TestingFeature → VersioningFeature → DockerFeature → DebianFeature → WorkflowFeature`. Each feature (`src/features/*.ts`) implements the `Feature` interface from `src/features/types.ts` (`shouldRun`, `apply`, `cleanup`) and is mode-aware (`cfg.backend`/`cfg.library`/`cfg.website`). Shared helpers live in `features/types.ts`: `createFile`/`createFileIfMissing` (config vs. source-code write semantics — the latter never overwrites, even with `--force`), `setScript`/`setDependency` (only overwrite an existing key with `--force`), `removeFile`.

Generated file *content* lives in `src/templates/*.ts` as plain string/function exports, re-exported via `src/templates/index.ts`. Most extend forgejs's own shipped base configs (`configs/*.json`/`*.cjs`, published via `package.json` `exports`) — the layered-config pattern: a generated project's `biome.json`/`tsconfig.json`/etc. `extends` the version bundled with forgejs, and `core.ts` adds `@apollogeddon/forgejs` itself as a `devDependency` so those files actually resolve after `npm install`.

**CI.** `.github/workflows/` holds forgejs's reusable pipelines, which projects call at `@main`:
- **Check pipelines:** `library`, `service` and `website` (stages lint, scan, test, build, plus `check` for the website).
- **Packaging:** `debian` and `docker`.
- **Release and delivery:** `version` (release-please), `publish` (package, assets, attest) and `pages` (deploy).
- **Housekeeping:** `patch` (osv-scanner fix) and `merge` (Dependabot review and squash).

Each is `on: workflow_call` only, and no pipeline calls another, so a run page reads `<pipeline> / <stage>`. A job's `name:` is its stage, and the job id is that stage in kebab case. A root workflow (the dot files, `.index.yml`) is what an event triggers: each of its jobs calls one pipeline, the job id is the pipeline's name, and a variant names itself in brackets (`patch (docs)`). forgejs's own `.index.yml` calls the pipelines locally and adds the `changes` job. `src/templates/workflows.ts`'s `indexWorkflow()` generates a project's `.github/workflows/.index.yml` per mode and flags.

`WorkflowFeature` replaces a pre-6.0 `index.yml` (or a pre-2.3.2 `ci.yml`/`debian.yml`) only once `.index.yml` is written:
- It removes one exactly as an earlier release generated it. Those are SHA-256 hashes of the normalised text in `src/templates/legacy.ts`.
- A changed one that calls forgejs's pipelines is removed only with `--force`.
- The project's own is never removed.

GitHub checks a called workflow's job permissions against the caller's grant even for skipped jobs, so `tests/actions.test.ts` checks that every root grant covers them.

`src/utils/filesystem.ts`'s `IFileSystem` abstraction (`NodeFileSystem` in production, injectable for tests) is what makes `--dry-run` a single code path rather than a parallel one, and lets `tests/index.test.ts` mock the filesystem where needed. `tests/integration.test.ts` is different: it does a *real* `npm install` (pointing the `@apollogeddon/forgejs` devDependency at this repo via `file:`) and runs the real generated scripts — this is the only place that catches wiring bugs like a config `extends`-ing a path nothing ever installs.

## Change checklist

Adding or changing a CLI flag or feature usually touches all of these — check each one before calling it done:

1. `src/index.ts` — the `parseArgs` option (plus its `no-<x>` negation for standard features) and the help text.
2. `src/types.ts` — the `InitConfig` field.
3. `src/features/<feature>.ts` — `shouldRun`/`apply`/`cleanup`; export new features from `src/features/index.ts` and add them to the pipeline list in `src/core.ts` in order.
4. `src/templates/<name>.ts` — generated content, re-exported from `src/templates/index.ts`; shipped base configs in `configs/` if the generated file `extends` one. A flag that changes CI goes into `indexWorkflow()` in `src/templates/workflows.ts`, and any input it passes must exist in the called pipeline in `.github/workflows/`.
5. `tests/index.test.ts` (unit, mocked filesystem); `tests/integration.test.ts` if it changes what gets installed or run; `tests/actions.test.ts` for the pipelines, forgejs's `.index.yml` and the generated `.index.yml` (stage names, inputs, outputs, permissions). Run `actionlint` on changed workflows and on generated output.
6. Docs: `docs/src/content/docs/getting-started.md` (flag reference), `configuration.md`, and `workflows/overview.md` (generated `.index.yml`, events, permissions) and `workflows/reference.md` (pipeline stages and inputs) for workflow changes.
