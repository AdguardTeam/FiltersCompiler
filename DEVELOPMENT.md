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
    - [ESLint Configuration](#eslint-configuration)
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
    - [Checkout Fails on Windows (`error: invalid path`)](#checkout-fails-on-windows-error-invalid-path)
- [Additional Resources](#additional-resources)

## Prerequisites

### Required Tools

| Tool                           | Version            | Notes                        |
| ------------------------------ | ------------------ | ---------------------------- |
| [Node.js](https://nodejs.org/) | 22                 | Use [nvm] to manage versions |
| [pnpm](https://pnpm.io/)       | >=10.33.4 and <11  | Package manager              |
| [Git](https://git-scm.com/)    | Latest             | Version control              |

> **Note**: Development is tested on macOS and Linux. Windows users should use
> WSL or a virtual machine. The repository must still be checkable out on
> native Windows, so do not commit paths that Git for Windows rejects — see
> [Checkout Fails on Windows](#checkout-fails-on-windows-error-invalid-path).

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

### ESLint Configuration

`eslint.config.js` is a native flat config with no dependency on `eslint-config-airbnb-base`.
That package cannot run on ESLint 10: `eslint-plugin-import` (which `airbnb-base` depends on)
calls a `SourceCode` method ESLint 10 removed.

Rather than replace the project's rule set, it was ported: the rules were captured from the
project's own effective configuration under ESLint 8 (`airbnb-base` 15.0.0 +
`plugin:@typescript-eslint/recommended` + `eslint-plugin-jsdoc` plus every project-specific
override the former `.eslintrc.cjs` carried) and written directly into `eslint.config.js`. This
was a one-time migration step, verified with a one-off config-and-lint comparison; the file is
self-contained and is not regenerated from the airbnb package at lint time or in CI.

Only one rule id actually changed on the way in: `import/*` is now `import-x/*`, since
`eslint-plugin-import-x` is the maintained fork used in place of `eslint-plugin-import`.
Formatting rules (`indent`, `quotes`, `semi`, `comma-dangle`, and the rest) are, and remain,
plain core rules — the former `.eslintrc.cjs` never overrode their TS-specific variants, so
there was never anything to move.

Three known, intentional differences from the old ESLint 8 configuration:

- `import-x/no-cycle`'s `disableScc` option no longer exists in the current rule's schema, so
  that one key was dropped from its options; the rest of the rule's configuration (`maxDepth`,
  `ignoreExternal`, etc.) is unchanged.
- ESLint 9+ changed `no-unused-vars`'s `caughtErrors` default from `"none"` to `"all"`. Five
  `catch (e)` blocks that never used the bound error started failing as a result — fixed by
  dropping the unused binding (`catch {}`), not by changing the rule's configuration.
- `no-undef` changes in both directions, because the `globals` package version changed
  (ESLint 8 bundled `globals` 13; this config uses `globals` 17):
    - Looser: names that are now defined and were not before, mostly modern browser APIs
      (`WeakRef`, `AggregateError`, `GPUDevice`, etc.). Kept as-is.
    - Stricter: about 30 names that were defined and now are not, e.g. `fdescribe`, `pit`,
      `applicationCache`, `openDatabase`, `registerProcessor`, `MediaStreamConstraints`. None of
      them are used in this repository, so no code needed to change.

ESLint 9+ also changed the defaults of four more rules (`no-inner-declarations`,
`no-constant-condition`, `no-useless-computed-key`, `no-shadow-restricted-names`); those are
pinned back to their ESLint 8 behaviour with explicit options in `eslint.config.js` rather than
left as differences.

Rule ids and options are otherwise identical to the pre-migration configuration. There is no
automated check enforcing this going forward — treat any future ESLint or plugin upgrade as a
normal config change, and update this section if a rule's behaviour needs to diverge from what
is documented here.

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

> **Note**: `pnpm tgz` requires a temporary `version` field in
> `package.json` — the workaround is documented in
> [AGENTS.md](AGENTS.md#build-and-test-commands). As an alternative, the Docker
> build accepts a `VERSION` build arg — see
> [DEPLOYMENT.md](DEPLOYMENT.md#docker-build).

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

Fixture names must be checkable out on native Windows. When a fixture needs a
name that cannot be committed (see the **Portable file names** guideline in
[AGENTS.md](AGENTS.md#testing)), create it at runtime in a temp directory, as
`withTempLocale` does in `test/locales-validator.test.js`:

```js
const tempDirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'locales-validator-'));
try {
    // create the fixture and run the assertions
} finally {
    fs.rmSync(tempDirPath, { recursive: true, force: true });
}
```

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

### Checkout Fails on Windows (`error: invalid path`)

**Problem**: `git clone` or `git checkout` fails on Windows with
`error: invalid path`, or a directory that exists in the repository is missing
after checkout.

**Solution**: Rename the offending path, or create that name at runtime in a
temp directory when a test needs it (see [Test Resources](#test-resources)).
The exact name restrictions are listed in the **Portable file names** guideline
in [AGENTS.md](AGENTS.md#testing).

List offending paths in the current revision, one command per rule case:

```bash
# Components ending with a space or a dot, or containing \ < > : " | ? *
git ls-files | grep -E '(^|/)[^/]*[ .](/|$)|[<>:"|?*\\]'
# Reserved device names: CON, PRN, AUX, NUL, COM1-COM9, LPT1-LPT9
git ls-files | grep -iE '(^|/)(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|/|$)'
# Paths that differ only by case
git ls-files | tr '[:upper:]' '[:lower:]' | sort | uniq -d
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
