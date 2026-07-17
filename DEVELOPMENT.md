# Development Guide

This guide covers setting up your development environment, building the library,
running tests, and contributing code to the AdGuard Filters Compiler.

## Table of Contents

- [Prerequisites](#prerequisites)
    - [Required Tools](#required-tools)
- [Getting Started](#getting-started)
    - [1. Clone the Repository](#1-clone-the-repository)
    - [2. Install Dependencies](#2-install-dependencies)
    - [3. Build the Library](#3-build-the-library)
    - [4. Run Tests](#4-run-tests)
    - [5. Run Linter](#5-run-linter)
- [Development Workflow](#development-workflow)
    - [Available Commands](#available-commands)
    - [TypeScript](#typescript)
    - [IDE Configuration](#ide-configuration)
    - [Before Committing](#before-committing)
    - [Branching Strategy](#branching-strategy)
- [Common Tasks](#common-tasks)
    - [Updating JSON Schemas](#updating-json-schemas)
    - [Updating Scriptlets and Redirects](#updating-scriptlets-and-redirects)
    - [Building a Release](#building-a-release)
- [Testing](#testing)
    - [Running Tests](#running-tests)
    - [Test Configuration](#test-configuration)
    - [Test Resources](#test-resources)
- [Troubleshooting](#troubleshooting)
    - [Node.js Version Issues](#nodejs-version-issues)
    - [pnpm Not Found](#pnpm-not-found)
    - [Schema Validation Errors After Manual Edit](#schema-validation-errors-after-manual-edit)
    - [Build or Type Errors After Adding a New File](#build-or-type-errors-after-adding-a-new-file)
    - [Lint Failures on Unrelated Files](#lint-failures-on-unrelated-files)
    - [Test Failures Due to Missing Test Resources](#test-failures-due-to-missing-test-resources)
- [Additional Resources](#additional-resources)

## Prerequisites

### Required Tools

| Tool                           | Version            | Notes                        |
| ------------------------------ | ------------------ | ---------------------------- |
| [Node.js](https://nodejs.org/) | 22                 | Use [nvm] to manage versions |
| [pnpm](https://pnpm.io/)       | >=10.33.4 and <11  | Package manager              |
| [Git](https://git-scm.com/)    | Latest             | Version control              |

> **Note**: Development is tested on macOS and Linux. Windows users should use
> WSL or a virtual machine.

[nvm]: https://github.com/nvm-sh/nvm

## Getting Started

### 1. Clone the Repository

```bash
# Private source repo (for contributors with access)
git clone https://github.com/AdGuardSoftwareLimited/ext-compiler.git
cd ext-compiler

# Public mirror (read-only)
# git clone https://github.com/AdguardTeam/FiltersCompiler.git
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Build the Library

```bash
pnpm build
```

Build output goes to `dist/` (ESM: `dist/index.js`, CJS: `dist/index.cjs`).
Rollup also copies JSON schemas and trust-level files into `dist/`.

### 4. Run Tests

```bash
pnpm test
```

### 5. Run Linter

```bash
pnpm lint
```

## Development Workflow

### Available Commands

| Command              | Description                                           |
| -------------------- | ----------------------------------------------------- |
| `pnpm install`       | Install dependencies                                  |
| `pnpm build`         | Build the library (Rollup → `dist/`)                  |
| `pnpm test`          | Run all tests (Vitest)                                |
| `pnpm lint`          | Run ESLint, TypeScript type checker, and markdownlint |
| `pnpm lint:code`     | Run ESLint                                            |
| `pnpm lint:types`    | Run TypeScript type checker (`tsc --noEmit`)          |
| `pnpm lint:md`       | Lint markdown files                                   |
| `pnpm build-schemas` | Regenerate JSON schemas from `tasks/build-schemas/`   |
| `pnpm tgz`           | Pack release tarball (`filters-compiler.tgz`)         |

> **Note**: `pnpm tgz` requires a `version` field in `package.json`, which
> this project intentionally omits (the version is injected at release time).
> To pack locally, set a temporary version first and revert it afterwards:
>
> ```bash
> npm pkg set version=0.0.0-dev
> pnpm tgz
> git checkout package.json
> ```
>
> Alternatively, use the Docker build which accepts a `VERSION` build arg —
> see [DEPLOYMENT.md](DEPLOYMENT.md#docker-build).

### TypeScript

New source files should be written in TypeScript. The project uses TypeScript
in `strict` mode for new `.ts` files while leaving existing `.js` files
unchanged.

#### Key Commands

| Command           | Description                                                       |
| ----------------- | ----------------------------------------------------------------- |
| `pnpm lint:code`  | ESLint — automatically uses the TypeScript parser for `.ts` files |
| `pnpm lint:types` | Run the TypeScript type checker (`tsc --noEmit`)                  |
| `pnpm build`      | Rollup — transpiles `.ts` files via `@rollup/plugin-typescript`   |

#### Adding a New TypeScript Module

1. Create your `.ts` file under `src/` (e.g., `src/main/utils/my-feature.ts`)
2. Import it from existing code — both `.js → .ts` and `.ts → .js` imports work
3. When importing a `.js` module from `.ts`, the import resolves to `any` via
   the ambient declaration in `src/types/global.d.ts`. For better type coverage,
   write a `.d.ts` shim alongside the `.js` file.
4. Run `pnpm lint && pnpm test && pnpm build`

#### Writing Tests in TypeScript

Create test files as `test/*.test.ts`. Vitest discovers both `.test.js` and
`.test.ts` files automatically.

#### Policy

- **New files**: Write in TypeScript
- **Existing files**: Leave as JavaScript until explicitly migrated
- **`allowJs` / `checkJs`**: Disabled — existing JS is not type-checked
- **`strict` mode**: Enabled for all `.ts` files
- **Naming collisions**: Do not create `foo.ts` alongside `foo.js` in the same
  directory — rename or migrate instead

### IDE Configuration

**VS Code** is the recommended editor. Create `.vscode/settings.json`:

```json
{
    "editor.tabSize": 4,
    "editor.insertSpaces": true,
    "editor.detectIndentation": false,
    "eslint.enable": true,
    "eslint.validate": ["javascript", "typescript"],
    "[javascript]": { "editor.defaultFormatter": "dbaeumer.vscode-eslint" },
    "[typescript]": { "editor.defaultFormatter": "dbaeumer.vscode-eslint" },
    "[markdown]": { "editor.defaultFormatter": "DavidAnson.vscode-markdownlint" }
}
```

Recommended VS Code extensions:

- `dbaeumer.vscode-eslint` — ESLint integration
- `DavidAnson.vscode-markdownlint` — Markdown linting
- `Orta.vox.vitest` — Vitest test runner integration

### Before Committing

Run these checks before every commit:

```bash
# 1. Lint (includes type-checking)
pnpm lint

# 2. Run tests
pnpm test
```

Both must pass with no errors. Husky pre-commit hook runs `pnpm lint && pnpm test`
automatically.

### Branching Strategy

1. Create a feature branch from `master`
2. Make your changes
3. Ensure `pnpm lint` and `pnpm test` pass
4. Submit a pull request to `master`

## Common Tasks

### Updating JSON Schemas

Schemas in `schemas/` are generated — **never edit them directly**. Edit the
generation scripts in `tasks/build-schemas/` instead:

```bash
pnpm build-schemas
```

> **Important**: Legacy schemas in `schemas/mac/` and `schemas/mac_v2/` must not
> be changed.

### Updating Scriptlets and Redirects

To add support for new scriptlets and redirects, update `@adguard/tsurlfilter`
(which bundles updated `@adguard/scriptlets`):

```bash
pnpm add @adguard/tsurlfilter@latest
```

For fixing scriptlets converting or validation specifically, update
`@adguard/scriptlets` directly:

```bash
pnpm add @adguard/scriptlets@latest
```

### Building a Release

Releases are fully automated via GitHub Actions. See
[DEPLOYMENT.md](DEPLOYMENT.md) for the complete release pipeline documentation.

## Testing

### Running Tests

```bash
# Run all tests once
pnpm test
```

### Test Configuration

- **Framework**: Vitest with node environment
- **Config**: `vitest.config.js`
- **Test files**: `test/*.test.{js,ts}`

### Test Resources

Test fixtures are in `test/resources/`:

- Filter files and platform configs used as test inputs
- Expected output files for comparison
- Some resources are gitignored (generated during test runs)

## Troubleshooting

### Node.js Version Issues

**Problem**: Build or tests fail with unexpected errors.

**Solution**: Ensure you are using Node.js 22:

```bash
node --version  # Should be v22.x.x
```

If using nvm:

```bash
nvm install 22
nvm use 22
```

### Schema Validation Errors After Manual Edit

**Problem**: Tests fail after directly editing files in `schemas/`.

**Solution**: Never edit schemas manually. Revert your changes and use the
generation scripts:

```bash
git checkout schemas/
# Edit tasks/build-schemas/ instead, then:
pnpm build-schemas
```

### pnpm Not Found

**Problem**: `pnpm: command not found`

**Solution**: Install pnpm globally via npm (recommended) or via corepack:

```bash
# Recommended: install globally via npm
npm install -g pnpm@10.33.4

# Alternative: use corepack (ships with Node.js)
corepack enable
corepack prepare pnpm@10.33.4 --activate
```

> **Note**: With corepack, disable auto-pinning — otherwise corepack adds a
> `packageManager` field (pinned to an exact version with a hash) to
> `package.json` on the first run, which this project intentionally does not
> use (the pnpm version is constrained by the `engines` field instead):
>
> ```bash
> export COREPACK_ENABLE_AUTO_PIN=0
> ```
>
> If the field was already added, revert it with `git checkout package.json`.

### Build or Type Errors After Adding a New File

**Problem**: `tsc --noEmit` fails with type errors after adding a new `.ts` file,
or the build fails to find your new module.

**Solution**:

1. Ensure the file is inside `src/` and has a `.ts` extension.
2. If importing from a `.js` file, the import resolves to `any` via
   `src/types/global.d.ts`. For better types, add a `.d.ts` shim next to the
   `.js` module.
3. Run `pnpm lint:types` to isolate type errors and confirm the fix.

### Lint Failures on Unrelated Files

**Problem**: `pnpm lint:code` reports errors in files you haven't changed.

**Solution**: The project uses ESLint with `--cache`. Clear the cache:

```bash
rm -f .eslintcache
pnpm lint:code
```

### Test Failures Due to Missing Test Resources

**Problem**: Tests fail because expected files are not found under
`test/resources/`.

**Solution**: Some test resources are generated during test execution and are
gitignored. Run the tests in the correct order — Vitest handles this
automatically when you run `pnpm test`. If tests still fail, try cleaning and
re-running:

```bash
git checkout test/resources/
pnpm test
```

## Additional Resources

- [AGENTS.md](AGENTS.md) — AI agent instructions and code guidelines
- [README.md](README.md) — Project overview and usage documentation
- [DEPLOYMENT.md](DEPLOYMENT.md) — Release pipeline and deployment documentation
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [FiltersRegistry](https://github.com/AdguardTeam/FiltersRegistry/) — Consumer
  of this library
- [AdGuard JavaScript Code Guidelines][code-guidelines] — Code style reference

[code-guidelines]: https://github.com/AdguardTeam/CodeGuidelines/blob/master/JavaScript/Javascript.md
