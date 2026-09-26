# Claude Code Instructions

## Subagent Model Routing

The main conversation (Sonnet) is the **orchestrator only** — it delegates work, synthesises results, and makes edits. It does not do bulk reading or deep planning itself.

### When to spawn and which model to use

| Task type | Model | Subagent type |
| --- | --- | --- |
| File reads, searches, grep/glob, log analysis, summarisation | `haiku` | `Explore` |
| Multi-file codebase exploration | `haiku` | `Explore` |
| General coding, edits, refactoring, moderate reasoning | `sonnet` (default, no spawn) | — |
| Architecture decisions, complex multi-file planning | `opus` | `Plan` or `claude` |
| Security review, deep debugging requiring judgment | `opus` | `claude` |
| Code review of a PR or branch | `opus` | `claude` |

### Rules

- **Never read more than ~2 files directly** in the main context. If a task requires reading more, spawn a Haiku `Explore` agent. Direct `Read`/`Grep` results land in the main Sonnet context and inflate cache costs on every subsequent turn. This is backed by a `PreToolUse` hook (`.claude/hooks/read-counter.cjs`) that counts `Read`/`Grep` calls per session and warns past the threshold — don't rely on memory alone.
- **Always spawn Opus for planning** before implementing anything non-trivial. Let Opus produce the plan, then execute it.
- **Subagent overhead** (~500 tokens cold context) is worth it whenever the agent would read more than a few hundred lines or produce reasoning that would otherwise fill the main context.
- Specify `model:` explicitly on every `Agent` call — never rely on the default for research or planning tasks. `Explore` and `Plan` are pinned to `haiku`/`opus` via `.claude/agents/Explore.md` and `.claude/agents/Plan.md`, so this is now a backstop, not the only enforcement — but `claude` (used for opus-tier review/security work) has no such override and still needs `model: "opus"` passed explicitly every time.

### Example routing

```text
# Exploration / research → Haiku
Agent(subagent_type: "Explore", model: "haiku", prompt: "Find all callers of X and what triggers each call")

# Planning → Opus
Agent(subagent_type: "Plan", model: "opus", prompt: "Design the fix for <problem>")

# Code review → Opus
Agent(subagent_type: "claude", model: "opus", prompt: "Review the changes on this branch for correctness")

# Implementation → Sonnet (main context, no spawn needed)
Edit(...)
```

## Tool Use

- Prefer dedicated tools (Read, Grep, Glob, Edit) over Bash for file operations.
- Use Grep/Glob directly for **single targeted lookups** where the result is small (one file, a few lines).
- For anything broader, spawn a Haiku `Explore` agent — don't dump large files into the main context.
- Never re-read a file you just edited; trust the edit succeeded.
- Run independent tool calls in parallel in a single response rather than sequentially.

## Responses

- Keep responses short and direct. No trailing summaries of what was just done.
- No comments explaining what code does — only add a comment when the *why* is non-obvious.
- No multi-paragraph docstrings or block comment headers.
- Do not add error handling, fallbacks, or abstractions beyond what the task requires.
- Do not suggest follow-up tasks or refactors unless asked.

## Quality Control

- A `PostToolUse` hook (`.claude/hooks/lint-on-edit.cjs`) runs `biome check --fix` on every file touched by `Edit`/`Write` under `src/**` — instant feedback, not a substitute for the checks below.
- Before reporting a non-trivial change complete, run `npm run lint && npm run type && npm run test`.
- Run `/code-review` (medium+) on non-trivial diffs before considering them done; use `/simplify` as a cleanup pass afterward.

## Architecture

forgejs is a project-scaffolding CLI: `src/index.ts` parses argv (`node:util` `parseArgs`, strict mode, explicit `--no-<x>` negation flags per standard feature), resolves an `InitConfig` (`src/types.ts`), and calls `init()` in `src/core.ts`.

`core.ts` loads/creates the target project's `package.json`, then runs an ordered **Feature pipeline** (`src/features/index.ts` exports the list): `BaseFeature → LintingFeature → BuildFeature → TestingFeature → VersioningFeature → DockerFeature → DebianFeature → WorkflowFeature`. Each feature (`src/features/*.ts`) implements the `Feature` interface from `src/features/types.ts` (`shouldRun`, `apply`, `cleanup`) and is mode-aware (`cfg.backend`/`cfg.library`/`cfg.website`). Shared helpers live in `features/types.ts`: `createFile`/`createFileIfMissing` (config vs. source-code write semantics — the latter never overwrites, even with `--force`), `setScript`/`setDependency` (only overwrite an existing key with `--force`), `removeFile`.

Generated file *content* lives in `src/templates/*.ts` as plain string/function exports, re-exported via `src/templates/index.ts`. Most extend forgejs's own shipped base configs (`configs/*.json`/`*.cjs`, published via `package.json` `exports`) — the layered-config pattern: a generated project's `biome.json`/`tsconfig.json`/etc. `extends` the version bundled with forgejs, and `core.ts` adds `@apollogeddon/forgejs` itself as a `devDependency` so those files actually resolve after `npm install`.

`src/utils/filesystem.ts`'s `IFileSystem` abstraction (`NodeFileSystem` in production, injectable for tests) is what makes `--dry-run` a single code path rather than a parallel one, and lets `tests/index.test.ts` mock the filesystem where needed. `tests/integration.test.ts` is different: it does a *real* `npm install` (pointing the `@apollogeddon/forgejs` devDependency at this repo via `file:`) and runs the real generated scripts — this is the only place that catches wiring bugs like a config `extends`-ing a path nothing ever installs.

## Context Management

- Use `/compact` when a session grows long to compress history before continuing.
- Use `/clear` when switching to an unrelated task rather than carrying stale context forward.
