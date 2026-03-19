# AGENTS.md

Instructions for LLM agents and human contributors working on this project.

## Project Overview

AdGuard Filters Compiler — a Node.js library that compiles ad-blocking filter
lists into platform-specific formats. It is consumed by [FiltersRegistry]
to produce production filter builds for AdGuard products across all supported
platforms (extensions and apps).

## Technical Context

- **Language**: JavaScript (ES2022 modules), Node.js 22
- **Package Manager**: pnpm 10.7
- **Bundler**: Rollup (dual ESM + CJS output)
- **Testing**: Vitest (node environment)
- **Linting**: ESLint with airbnb-base config
- **Target Platform**: Node.js (library)
- **Project Type**: Single package
- **Key Dependencies**:
    - `@adguard/agtree`
    - `@adguard/tsurlfilter`
    - `@adguard/scriptlets`
    - `@adguard/filters-downloader`

## Project Structure

```text
├── src/
│   ├── index.js                  # Library entry point (compile, validateJSONSchema, validateLocales)
│   └── main/
│       ├── builder.js            # Core filter compilation logic
│       ├── converter.js          # Rule format conversion
│       ├── validator.js          # Filter rule validation
│       ├── optimization.js       # Filter list optimization
│       ├── platforms-config.js   # Platform definitions and configuration
│       ├── json-validator.js     # JSON schema validation for built filters
│       ├── locales-validator.js  # Locales validation
│       ├── platforms/
│       │   ├── generator.js      # Platform-specific filter generation
│       │   └── filter.js         # Platform filter processing
│       ├── rule/
│       │   └── rule-masks.js     # Rule mask constants
│       └── utils/
│           ├── log.js            # Logger utility
│           ├── report.js         # Compilation report generation
│           ├── builder-utils.js  # Builder helper functions
│           ├── extended-css-validator.js  # Extended CSS validation
│           ├── version.js        # Version utilities
│           ├── webutils.js       # Web-related utilities
│           ├── workaround.js     # Platform-specific workarounds
│           ├── utils.js          # General utilities
│           └── trust-levels/     # Trust-level exclusion files (low, high, full)
├── test/                         # Test files (Vitest)
│   ├── resources/                # Test fixtures and filter data
│   └── utils/                    # Test utilities
├── schemas/                      # JSON schemas for validating built filters
│   ├── filters.schema.json       # Filters metadata schema
│   ├── filters_i18n.schema.json  # Filters i18n metadata schema
│   ├── mac/                      # Legacy macOS v1 schemas (do not modify)
│   └── mac_v2/                   # macOS v2 schemas (do not modify)
├── tasks/
│   ├── build-schemas/            # Schema generation scripts
│   └── build-txt.mjs             # Build version text file
├── bamboo-specs/                 # Bamboo CI/CD pipeline definitions
├── index.js                      # Development entry point (unbundled)
├── package.json                  # Project metadata and scripts
├── rollup.config.js              # Rollup bundler configuration
├── vitest.config.js              # Vitest test configuration
├── AGENTS.md                     # AI agent instructions (this file)
├── DEVELOPMENT.md                # Development environment setup guide
├── README.md                     # Project overview and usage documentation
└── CHANGELOG.md                  # Version history
```

## Build And Test Commands

| Command | Description |
| ------- | ----------- |
| `pnpm install` | Install dependencies |
| `pnpm build` | Build the library (Rollup → `dist/`) |
| `pnpm test` | Run all tests (Vitest) |
| `pnpm lint` | Run ESLint |
| `pnpm build-schemas` | Regenerate JSON schemas from `tasks/build-schemas/` |
| `pnpm build-txt` | Generate `dist/build.txt` with version info |
| `pnpm increment` | Bump patch version (`package.json`) |
| `pnpm tgz` | Pack release tarball (`filters-compiler.tgz`) |

## Contribution Instructions

You MUST follow the following rules for EVERY task that you perform:

- You MUST run `pnpm lint` and `pnpm test` before completing a task. Both are
  enforced by Husky pre-commit hook.

- When the task changes code in `src/`, update `CHANGELOG.md` in the
  `Unreleased` section. Add entries to the appropriate subsection (`Added`,
  `Changed`, or `Fixed`); do not create duplicate subsections.
  Documentation-only changes (e.g., `AGENTS.md`, `DEVELOPMENT.md`, `README.md`)
  do NOT belong in the changelog.

- When adding an `## [Unreleased]` section to `CHANGELOG.md`, always add the
  corresponding link reference immediately after the section's last entry,
  pointing to `HEAD` from the latest released version, e.g.:

  ```markdown
  [Unreleased]: https://github.com/AdguardTeam/FiltersCompiler/compare/vX.Y.Z...HEAD
  ```

  where `vX.Y.Z` is the latest versioned tag in the changelog.

- **Never edit JSON schemas in `schemas/` manually.** Edit the generation
  scripts in `tasks/build-schemas/` and run `pnpm build-schemas` to regenerate.

- Legacy schemas in `schemas/mac/` and `schemas/mac_v2/` must not be changed.

- No new metadata fields should be added for old `mac` and current `mac_v2`
  platforms — see `src/main/platforms/generator.js` for details.

- When updating scriptlets/redirects support, update `@adguard/tsurlfilter`
  (which bundles updated `@adguard/scriptlets`). For fixing scriptlets
  converting or validation, update `@adguard/scriptlets` directly.

## Code Guidelines

### I. Style

Follow the [AdGuard JavaScript Code Guidelines][code-guidelines] for
conventions not covered by the linter.

[code-guidelines]: https://github.com/AdguardTeam/CodeGuidelines/blob/master/JavaScript/Javascript.md

1. **ES module syntax** (`import`/`export`). The project uses
   `"type": "module"` in `package.json`.

2. **ESLint airbnb-base** rules apply. Run `pnpm lint` to check.

### II. Architecture

1. **Dual output format.** Rollup produces both ESM (`dist/index.js`) and CJS
   (`dist/index.cjs`). The library is consumed via `@adguard/filters-compiler`
   by [FiltersRegistry].

2. **Schemas are copied to `dist/`.** Rollup copies `schemas/*` and
   `src/main/utils/trust-levels/*` into `dist/` at build time.

3. **Three public API functions** are exported from `src/index.js`:
   `compile`, `validateJSONSchema`, `validateLocales`.

### III. Testing

1. **Vitest** with node environment. Test files are in `test/*.test.js`.

2. **Test resources** are in `test/resources/` (filter files, platform configs,
   expected outputs). Some resources are gitignored (generated during tests).

[FiltersRegistry]: https://github.com/AdguardTeam/FiltersRegistry/
