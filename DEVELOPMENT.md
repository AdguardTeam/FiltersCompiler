# Development Guide

This guide covers setting up your development environment, building the library,
running tests, and contributing code to the AdGuard Filters Compiler.

## Prerequisites

### Required Tools

| Tool | Version | Notes |
| ---- | ------- | ----- |
| [Node.js](https://nodejs.org/) | 22 | Use [nvm](https://github.com/nvm-sh/nvm) to manage versions |
| [pnpm](https://pnpm.io/) | 10.7 | Package manager |
| [Git](https://git-scm.com/) | Latest | Version control |

> **Note**: Development is tested on macOS and Linux. Windows users should use
> WSL or a virtual machine.

## Getting Started

### 1. Clone the Repository

```bash
# GitHub
git clone https://github.com/AdguardTeam/FiltersCompiler.git
# or internal Bitbucket mirror — use the canonical URL for your environment
cd FiltersCompiler
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

| Command | Description |
| ------- | ----------- |
| `pnpm install` | Install dependencies |
| `pnpm build` | Build the library (Rollup → `dist/`) |
| `pnpm test` | Run all tests (Vitest) |
| `pnpm lint` | Run ESLint and TypeScript type checker |
| `pnpm lint:code` | Run ESLint |
| `pnpm lint:types` | Run TypeScript type checker (`tsc --noEmit`) |
| `pnpm build-schemas` | Regenerate JSON schemas from `tasks/build-schemas/` |
| `pnpm build-txt` | Generate `dist/build.txt` with version info |
| `pnpm increment` | Bump patch version in `package.json` |
| `pnpm tgz` | Pack release tarball (`filters-compiler.tgz`) |

### TypeScript

New source files should be written in TypeScript. The project uses TypeScript
in `strict` mode for new `.ts` files while leaving existing `.js` files
unchanged.

#### Key Commands

| Command | Description |
| ------- | ----------- |
| `pnpm lint:code` | ESLint — automatically uses the TypeScript parser for `.ts` files |
| `pnpm lint:types` | Run the TypeScript type checker (`tsc --noEmit`) |
| `pnpm build` | Rollup — transpiles `.ts` files via `@rollup/plugin-typescript` |

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

## Spec-Driven Development (SDD)

Changes that affect `src/` should be guided by a lightweight spec authored
**before** implementation begins.

### Spec Lifecycle

1. **Draft** — create a new spec in `specs/.current/` (this directory is
   local-only; its contents are gitignored).
2. **Review** — share the spec for review (e.g., attach to the PR description
   or a JIRA ticket).

### Spec Structure

A spec directory contains at minimum:

| File | Purpose |
| ---- | ------- |
| `spec.md` | Problem statement, proposed solution, and acceptance criteria |

Additional files (diagrams, example filter snippets, etc.) may be added as
needed.

### Mapping Specs to Tests

- Each acceptance criterion in the spec should correspond to at least one test
  case in `test/`.
- Reference the spec path in the test description or a comment so reviewers can
  trace coverage back to the spec.
- If full test coverage is deferred, note it as "future work" in the spec.

### Quick Reference

```text
specs/
├── .current/          # WIP — local only, gitignored contents
│   └── .gitkeep
├── add-platform-x/    # Finalized and committed
│   └── spec.md
└── ...
```

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

```bash
# 1. Bump the patch version
pnpm increment

# 2. Build the library
pnpm build

# 3. Generate build info
pnpm build-txt

# 4. Pack the tarball
pnpm tgz
```

This produces `filters-compiler.tgz` ready for publishing.

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

**Solution**: Install pnpm globally:

```bash
npm install -g pnpm
# or
corepack enable
corepack prepare pnpm@latest --activate
```

## Additional Resources

- [AGENTS.md](AGENTS.md) — AI agent instructions and code guidelines
- [README.md](README.md) — Project overview and usage documentation
- [CHANGELOG.md](CHANGELOG.md) — Version history
- [FiltersRegistry](https://github.com/AdguardTeam/FiltersRegistry/) — Consumer
  of this library
- [AdGuard JavaScript Code Guidelines](https://github.com/AdguardTeam/CodeGuidelines/blob/master/JavaScript/Javascript.md) — Code style reference
