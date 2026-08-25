# AGENTS.md

Instructions for LLM agents and human contributors working on this project.

- [Project Overview](#project-overview)
- [Technical Context](#technical-context)
- [Project Structure](#project-structure)
- [Build And Test Commands](#build-and-test-commands)
- [Contribution Instructions](#contribution-instructions)
- [Code Guidelines](#code-guidelines)
    - [System Design](#system-design)
    - [Architecture](#architecture)
    - [Code Quality](#code-quality)
    - [Testing](#testing)
    - [Dependency Management](#dependency-management)
    - [Configuration & Documentation](#configuration--documentation)
    - [Markdown Formatting](#markdown-formatting)

## Project Overview

AdGuard Filters Compiler — a Node.js library that compiles ad-blocking filter
lists into platform-specific formats. It is consumed by [FiltersRegistry]
to produce production filter builds for AdGuard products across all supported
platforms (extensions and apps).

The library exposes four public API functions: `compile`, `validateJSONSchema`,
`validateLocales`, and `localOptimizationStatistics`.

## Technical Context

- **Language**: JavaScript (ES2022 modules), Node.js >=22
- **Package Manager**: pnpm >=10.33.4 and <11
- **Bundler**: Rollup (dual ESM + CJS output)
- **Testing**: Vitest (node environment, `test/*.test.{js,ts}`)
- **Code Linting**: ESLint 8 with airbnb-base config (4-space indent, 120
  char max line length)
- **Type Checking**: TypeScript 6 (`strict` mode, new `.ts` files only)
- **Markdown Linting**: markdownlint (120 char line length, dash ul-style)
- **Target Platform**: Node.js (library)
- **Project Type**: Single package
- **Key Dependencies**:
    - `@adguard/agtree` — AST-based rule parsing, conversion, and generation
    - `@adguard/tsurlfilter` — `NetworkRule`, `CosmeticRule`, `RuleFactory`
      (bundles `@adguard/scriptlets`)
    - `@adguard/filters-downloader` — resolving `!#include` preprocessor
      directives
    - `@adguard/logger` — base logging infrastructure
    - `@adguard/ecss-tree` — CSS parsing for validation
    - `@adguard/extended-css` — CSS selector validation
    - `ajv` — JSON schema validation for built filter metadata

## Project Structure

```text
├── src/
│   ├── index.js                       # Public API entry point (4 exports)
│   ├── index.d.ts                     # Hand-written type declarations
│   └── main/
│       ├── builder.js                 # Core compilation pipeline orchestrator
│       ├── converter.js               # Rule format conversion (AGF ↔ uBO)
│       ├── validator.js               # Filter rule validation
│       ├── optimization.ts            # Hit-count-based rule optimization
│       ├── platforms-config.js        # Platform definitions and configuration
│       ├── json-validator.js          # JSON schema validation for built filters
│       ├── locales-validator.js       # Locale files completeness validation
│       ├── platforms/
│       │   ├── generator.js           # Platform-specific filter generation
│       │   └── filter.js              # Per-platform rule cleanup
│       ├── rule/
│       │   └── rule-masks.js          # Rule mask string constants
│       └── utils/
│           ├── log.ts                 # CompilerLogger (wraps @adguard/logger)
│           ├── report.js              # Compilation report builder
│           ├── builder-utils.js       # Helper functions (domain optimization)
│           ├── extended-css-validator.js  # CSS selector validation
│           ├── concurrent.ts          # Bounded-concurrency task runner
│           ├── version.ts             # Version parsing and incrementing
│           ├── webutils.ts            # HTTP download via curl
│           ├── workaround.js          # Platform-specific hacks and workarounds
│           ├── utils.js               # General utility functions
│           └── trust-levels/          # Filter-list trust-level exclusion files
├── test/                              # Test files (Vitest)
│   ├── resources/                     # Test fixtures and filter data
│   └── utils/                         # Test utilities
├── schemas/                           # JSON schemas for validating built filters
│   ├── filters.schema.json            # Filters metadata schema
│   ├── filters_i18n.schema.json       # Filters i18n metadata schema
│   ├── mac/                           # Legacy macOS v1 schemas (do not modify)
│   └── mac_v2/                        # macOS v2 schemas (do not modify)
├── tasks/
│   └── build-schemas/                 # Schema generation scripts
├── .github/
│   └── workflows/                     # GitHub Actions CI/CD pipelines
├── index.js                           # Development entry point (unbundled)
├── package.json                       # Project metadata and scripts
├── rollup.config.js                   # Rollup bundler configuration
├── vitest.config.js                   # Vitest test configuration
├── tsconfig.json                      # TypeScript configuration
├── .eslintrc.cjs                      # ESLint configuration
├── .markdownlint.json                 # Markdownlint configuration
├── Dockerfile                         # Multi-stage Docker build
├── AGENTS.md                          # AI agent instructions (this file)
├── CHANGELOG.md                       # Version history
├── DEPLOYMENT.md                      # Release pipeline documentation
├── DEVELOPMENT.md                     # Development environment setup guide
└── README.md                          # Project overview and usage
```

## Build And Test Commands

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

`pnpm tgz` requires a `version` field in `package.json`, which is
intentionally absent — set a temporary one first
(`npm pkg set version=0.0.0-dev`, revert with `git checkout package.json`)
or use the Docker build with the `VERSION` build arg (see DEPLOYMENT.md).

## Contribution Instructions

- You MUST verify your changes with the linter, formatter, and type checker
  before completing a task.

  Use the following commands:
    - `pnpm lint` to run all linters (ESLint + TypeScript + markdownlint)
    - `pnpm lint:code` to run ESLint only
    - `pnpm lint:types` to run TypeScript type checking (`tsc --noEmit`)
    - `pnpm lint:md` to lint markdown files

- You MUST update the unit tests for changed code. When modifying existing
  behaviour, update the relevant test files in `test/` and add new test cases
  for new functionality.

- You MUST run `pnpm test` to verify that your changes do not break existing
  functionality. Both `pnpm lint` and `pnpm test` are enforced by the Husky
  pre-commit hook.

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

- When making changes to the project structure, ensure the Project Structure
  section in `AGENTS.md` is updated to reflect the current layout.

- If the prompt asks you to refactor or improve existing code, check if you can
  phrase it as a code guideline. If so, add it to the relevant Code Guidelines
  subsection in `AGENTS.md`.

- After completing a task, verify that the code you've written follows the Code
  Guidelines in this file.

- **Never edit JSON schemas in `schemas/` manually.** Edit the generation
  scripts in `tasks/build-schemas/` and run `pnpm build-schemas` to regenerate.

- Legacy schemas in `schemas/mac/` and `schemas/mac_v2/` must not be changed.

- No new metadata fields should be added for old `mac` and current `mac_v2`
  platforms — see `src/main/platforms/generator.js` for details.

- When updating scriptlets/redirects support, update `@adguard/tsurlfilter`
  (which bundles updated `@adguard/scriptlets`). For fixing scriptlets
  converting or validation, update `@adguard/scriptlets` directly.

## Code Guidelines

### System Design

Design for a library:

- The library is consumed by other code — never access the filesystem, network,
  or environment unless the caller explicitly opts in. Keep side effects out of
  the default code path.
- Export a stable public API; internal functions and types MUST be explicitly
  marked as private or internal.
- Keep the dependency footprint minimal — every transitive dependency becomes
  a burden on consumers. Prefer built-in APIs over adding packages.
- Do not mutate global state (environment variables, process listeners, shared
  singletons) — the consumer may use the library in a long-running process
  alongside other code.
- Provide complete type definitions so the library is usable with static type
  checking and editor autocompletion out of the box.
- Document every public function, class, and type with doc comments — consumers
  should not need to read source code to use the library.
- Handle errors by throwing specific, documented error classes — let the
  consumer decide how to recover.

### Architecture

The following universal principles apply to the codebase:

- **Separation of Concerns** — each module handles one aspect of the system
  (e.g., conversion, validation, optimization).
- **Single Responsibility Principle** — every file, class, or function has one
  reason to change.
- **Dependency Direction** — dependencies point inward / downward; never from
  lower layers to higher ones.
- **Explicit Boundaries** — module interfaces are intentional; no reaching into
  internals. The public API surface is explicitly limited to 4 functions.
- **Data Flow Clarity** — data moves through the system in a predictable,
  traceable path (template → compiled rules → platform output).
- **Minimize Coupling, Maximize Cohesion** — modules are self-contained and
  interact through narrow interfaces.
- **Make Invalid States Impossible** — use types and validation to prevent
  illegal combinations at compile time.
- **Observability Built-in** — logging and compilation reports are first-class
  concerns, not afterthoughts.
- **Keep It Boring** — prefer well-understood patterns (pipeline, accumulator
  arrays) over clever or novel solutions.

The easiest way to achieve these principles is **layered architecture**. This
project's layers, from top to bottom:

<!-- markdownlint-disable MD060 -->
| Layer | Responsibility | Key Files |
| --- | --- | --- |
| Public API | Entry point, export surface | `src/index.js` |
| Core Pipeline | Compilation orchestration, include resolution | `src/main/builder.js` |
| Platform Generator | Platform-specific output, `!#if` resolution | `src/main/platforms/generator.js` |
| Supporting Modules | Rule conversion, validation, optimization | `converter.js`, `validator.js`, `optimization.js`, etc. |
| Utilities | Logging, reporting, versioning, workarounds | `src/main/utils/*` |
<!-- markdownlint-enable MD060 -->

Dependency flow:

```text
src/index.js (Public API)
     ↓
src/main/builder.js (Core Compilation Pipeline)
     ↓           ↓           ↓           ↓
converter.js  validator.js  optimization.ts  platforms/generator.js
     ↓           ↓                             ↓
  workaround  extended-css                  platforms/filter.js
  rule-masks  validator                     workaround
```

Lower layers may never import from higher layers. No layer may import from the
Public API layer.

**Known exclusions** (architecture debt to be fixed):

- `src/main/builder.js` (~950 lines) is a god object — it handles file I/O,
  include directive resolution, conversion orchestration, validation, and the
  main build loop. Should be split into focused modules.
- `src/main/utils/workaround.js` mixes platform-specific hacks with core
  compilation logic (header rewriting, EasyList filtering, rule filtering).
  Violates Single Responsibility Principle.
- Global mutable state in `src/main/platforms/generator.js` and
  `src/main/optimization.ts` — module-level variables set by `init()` make the
  code non-reentrant-safe. The TODO in `generator.js` confirms this is known.
- Synchronous I/O throughout (`readFileSync`, `writeFileSync`,
  `execFileSync`) — acceptable for a build tool, but prevents use in
  long-running server processes.

### Code Quality

- **Indentation**: 4 spaces. Configured in ESLint (`indent` rule).
- **Line length**: 120 characters maximum (code and comments). Configured in
  ESLint (`max-len` rule) and markdownlint.
- **Semicolons**: Required (enforced by airbnb-base).
- **String quotes**: Single quotes preferred (airbnb-base default).
- **Trailing commas**: Required for multi-line objects and arrays (airbnb-base
  default).
- **Unused variables**: Forbidden. ESLint enforces `no-unused-vars` (JS) and
  `@typescript-eslint/no-unused-vars` (TS).
- **Import extensions**: Required for local imports in JS files (`.js`, `.ts`
  extensions must be specified). TypeScript files are exempt.
- **No useless escape characters**: Disabled (`no-useless-escape: off`).
- **Param reassignment**: Permitted (`no-param-reassign: off`).
- **Prefer destructuring**: Encouraged for objects in variable declarations,
  arrays in assignment expressions.
- **Default exports**: Not required (`import/prefer-default-export: 0`).
- **AdGuard JavaScript Code Guidelines**: Follow for conventions not covered by
  the linter (see [style guide][code-guidelines]).
- **ES module syntax**: Always use `import`/`export` (`"type": "module"` in
  `package.json`).
- **TypeScript for new code**: New source files should be written in TypeScript
  (`.ts`) under `src/`. Existing `.js` files are not migrated yet.

### Testing

- **Framework**: Vitest with `node` environment.
- **Test file placement**: All tests live in `test/`. The test runner includes
  `test/*.test.{js,ts}`.
- **Test resources**: Place test fixtures in `test/resources/` (filter files,
  platform configs, expected outputs). Some resources are gitignored (generated
  during tests).
- **Coverage**: Not currently enforced by CI. Tests must cover changed code.
- **Mocking**: External network requests are mocked or use local fixtures. The
  `@adguard/filters-downloader` dependency is tested with local filter data.
- **Pre-commit enforcement**: `pnpm lint` and `pnpm test` run via Husky
  pre-commit hook. Both must pass before commits are allowed.

### Dependency Management

- **Pin all dependency versions explicitly** — do not use version ranges that
  allow automatic upgrades to untested versions. All dependencies in
  `package.json` use exact versions (e.g., `4.0.5` not `^4.0.5`).
- **Prefer vanilla solutions** — use Node.js built-in APIs when they
  adequately solve the problem. Only add a dependency when it provides
  significant value over a vanilla implementation.
- **Reputable sources only** — dependencies MUST come from well-established,
  actively maintained projects. The `@adguard/*` scope is managed by the
  AdGuard team.
- **Avoid unpopular libraries** — do NOT add niche or obscure packages with
  limited community adoption. These pose security risks and may become
  unmaintained.
- **Minimize dependency count** — each new dependency increases attack surface,
  bundle size, and maintenance burden. Justify every addition.
- **Use the latest stable version** — when adding a new dependency, explicitly
  check the package registry for the latest stable release and use it. Do not
  copy outdated version numbers from memory, training data, or existing lock
  files of other projects.

**Rationale**: Fewer, well-vetted dependencies reduce security vulnerabilities,
supply chain risks, and long-term maintenance costs.

**Known exclusions** (to be fixed in the future):

- `child_process` (1.0.2) — duplicates Node.js built-in `child_process`
  module. Should be removed.
- `utf8` (3.0.0) — Node.js provides `TextEncoder` / `TextDecoder` natively.
  Should be removed.
- `md5` (2.3.0) — Node.js `crypto` module provides MD5 hashing. Should be
  replaced.
- `moment` (2.30.1) — large date library. Could be replaced with built-in
  `Date` or a smaller alternative.
- `jsdom` (21.1.2) — heavy dependency for CSS selector validation. Keep for
  now but evaluate lighter alternatives.

### Configuration & Documentation

- **Runtime configuration**: The library is configured at compile time via
  the `customPlatformsConfig` parameter passed to `compile()`. There is no
  runtime config file or environment variable mechanism.
- **Platform definitions**: Static configuration is defined in
  `src/main/platforms-config.js`. This file defines all 16 platform
  configurations with their `removeRulePatterns`, `defines`, and metadata.
- **Schema generation**: JSON schemas in `schemas/` are generated by scripts
  in `tasks/build-schemas/`. Never edit schema files directly — always modify
  the generation scripts and run `pnpm build-schemas`.
- **Legacy schemas**: `schemas/mac/` and `schemas/mac_v2/` are legacy and must
  not be modified. No new metadata fields should be added for these platforms.
- **Documentation files that MUST be updated when code changes**:
    - `AGENTS.md` — project structure, commands, code guidelines
    - `CHANGELOG.md` — version history under `Unreleased`
    - `DEVELOPMENT.md` — setup instructions (when build steps change)
    - `DEPLOYMENT.md` — release pipeline (when deployment process changes)
    - `README.md` — usage examples (when the public API changes)
- **Hardcoded values**: Avoid hardcoding URLs, platform names, or filter IDs
  deep in business logic. Centralize them in configuration constants.

### Markdown Formatting

All Markdown files MUST follow these formatting rules:

- **Line length**: Keep lines at most 80 characters, but don't overwrap the
  lines artificially short just to hit the limit, keep them close to 80
  characters where possible. This is not a hard lint gate, but SHOULD be
  followed for readability. Lines inside fenced code blocks are exempt from
  this limit.
- **Unordered lists**: Use dashes (`-`) for bullet points. Indent nested list
  items by 4 spaces.
- **Continuation lines**: When a list item wraps to the next line, align the
  continuation with the first character of the item text, not the list marker.
  This applies to all list types (ordered and unordered).
- **Emphasis**: Use asterisks (`*`) for emphasis (`*italic*`, `**bold**`). Do
  NOT use underscores.
- **Headings**: Duplicate heading names are allowed only among sibling
  headings (same parent level). Avoid duplicates across different levels.
- **Inline HTML**: Avoid raw HTML in Markdown. The only allowed elements are
  `<a>`, `<p>`, `<details>`, `<summary>`, and `<img>`.
- **Trailing spaces**: Do NOT leave trailing whitespace on any line. Do NOT
  use two-space line breaks — use a blank line instead.
- **Bare URLs**: Bare URLs are permitted and do not need to be wrapped in
  angle brackets.
- **Table formatting**: Align table columns with padding when the table fits
  within 80 characters. If the table exceeds 80 characters or triggers an MD060
  linter warning, switch to a compact format using single spaces only. This
  applies to the separator row as well — it should be written as `| --- |`, not
  `|--|`.

  Example of correct layout:

  ```markdown
  | Col1   | Col2   |
  | ------ | ------ |
  | Value1 | Value2 |
  ```

  Do NOT use extra padding or alignment characters beyond single spaces.

**Rationale**: Uniform Markdown formatting improves readability for both
humans and AI agents that consume project documentation. The project's
markdownlint configuration enforces these rules (see `.markdownlint.json`).

[code-guidelines]: https://github.com/AdguardTeam/CodeGuidelines/blob/master/JavaScript/Javascript.md
[FiltersRegistry]: https://github.com/AdguardTeam/FiltersRegistry/
