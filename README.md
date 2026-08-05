# AdGuard Filters Compiler

> A Node.js library that compiles, converts, validates, and optimizes
> ad-blocking filter lists into platform-specific formats for AdGuard
> products across all supported platforms.

> **Note:** This package is developed in [AdGuardSoftwareLimited/ext-compiler].
> The [AdguardTeam/FiltersCompiler] repository is a public mirror.

## Description

**AdGuard Filters Compiler** is a library for developers who maintain
ad-blocking filter lists and the build pipelines that ship them. It
transforms source filter lists — written in the AdGuard filter rules
syntax — into compiled output tailored to each target platform (browser
extensions, desktop and mobile apps, and the AdGuard CLI).

AdGuard's filter rules are authored once but must run on many engines
with different capabilities: not every platform supports scriptlets,
HTML filtering, `$redirect` modifiers, extended CSS, or regex-based
`$domain` selectors. The compiler closes that gap. It resolves
`@include` and `!#include` preprocessor directives, converts rules
between AdGuard and uBlock Origin formats, validates each rule against
the `@adguard/tsurlfilter` engine, optimizes blocking rules using
hit-count statistics, and strips rules that a given platform cannot
apply.

The library is consumed by [FiltersRegistry] to produce production
filter builds, but it can be used directly by anyone who needs to
compile filter lists for AdGuard platforms. The expected source
directory structure and the filters metadata format are documented in
the [FiltersRegistry README][filters-metadata].

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Overview](#api-overview)
- [Usage Examples](#usage-examples)
    - [Compiling filter lists](#compiling-filter-lists)
    - [Validating built filters](#validating-built-filters)
    - [Validating locale translations](#validating-locale-translations)
- [`@include` directive and its options](#include-directive)
- [Configuration](#configuration)
    - [Custom platforms](#custom-platforms)
    - [Logging](#logging)
    - [Environment variables](#environment-variables)
- [Supported platforms](#supported-platforms)
- [Documentation](#documentation)

---

## Installation

```bash
npm install @adguard/filters-compiler
```

Also available via pnpm or yarn:

```bash
pnpm add @adguard/filters-compiler
# or
yarn add @adguard/filters-compiler
```

The package ships as dual ESM + CJS, so both `import` and `require`
work out of the box.

## Quick Start

```js
import { compile } from '@adguard/filters-compiler';

const filtersDir = './filters';
const logPath = './log.txt';
const reportPath = './report.txt';
const platformsPath = './platforms';

// Compile every filter for every platform, keeping only filters
// with IDs 1 and 3, and excluding filter ID 2.
await compile(filtersDir, logPath, reportPath, platformsPath, [1, 3], [2]);
```

The compiler reads the source filter lists from `filtersDir` and writes
platform-specific output to subdirectories under `platformsPath`. A
human-readable compilation report is written to `reportPath`, and a
timestamped log to `logPath`.

## API Overview

The library exports four functions:

| Function                      | Purpose                                              |
| ----------------------------- | ---------------------------------------------------- |
| `compile(...)`                | Compiles filter lists into platform-specific output  |
| `validateJSONSchema(...)`     | Validates built platform output against JSON schemas |
| `validateLocales(...)`        | Validates locale translation files for completeness  |
| `localOptimizationStatistics` | Caches optimization statistics for local compilation |

### `compile(...)`

```ts
function compile(
    path: string,
    logPath: string | undefined,
    reportFile: string | undefined,
    platformsPath: string | null,
    includedFilterIds?: number[] | null,
    excludedFilterIds?: number[] | null,
    customPlatformsConfig?: CustomPlatformsConfig,
): Promise<void>;
```

Compiles the filter lists in `path` for all configured platforms and
writes the results to `platformsPath`.

- `includedFilterIds` — compile only the filter IDs listed here (empty array
  compiles all filters).
- `excludedFilterIds` — exclude the filter IDs listed here.
- `customPlatformsConfig` — overrides or extends the built-in platform
  definitions (see [Custom platforms](#custom-platforms)).

### `validateJSONSchema(...)`

```ts
function validateJSONSchema(
    platformsPath: string,
    requiredFiltersAmount: number,
): boolean;
```

Recursively validates the built JSON files in `platformsPath` against
the schemas bundled with the library (`filters.schema.json` and
`filters_i18n.schema.json`). `requiredFiltersAmount` is the minimum
number of filters expected in each platform's `filters.json`.

Returns `true` when all files are valid. On validation failure it logs
the errors and returns `false` instead of throwing, so callers must
check the return value.

### `validateLocales(...)`

```ts
function validateLocales(
    localesDirPath: string,
    requiredLocales: string[],
): ValidateLocalesResult;

interface ValidateLocalesResult {
    ok: boolean;
    data?: unknown[]; // per-locale warning details, present when warnings exist
    log?: string;     // formatted warnings log, present when warnings exist
}
```

Validates that the locale files in `localesDirPath` are complete — that
every filter, group, and tag has a translated name and description for
all locales listed in `requiredLocales`.

Returns `{ ok: true }` when no problems are found. When warnings are
found, `data` and `log` contain the per-locale details and `ok` is
`false` only if at least one warning is critical. Throws when the
locales directory is missing or empty.

### `localOptimizationStatistics`

A namespace for caching optimization statistics locally so that
`compile()` reads each filter's `stats.json` from disk instead of
fetching it from the remote server. `percent.json` (which determines
which filters are optimizable) is always fetched remotely, even when
using the local cache.

It exposes `download`, `use`, and `reset` methods and throws
`OptimizationStatsError` (an `Error` subclass carrying `filterId` and
`sourcePath` fields) when stats for a filter cannot be retrieved.

See [Local Optimization Statistics](#local-optimization-statistics)
for a complete workflow.

## Usage Examples

### Compiling filter lists

Compile all filters with the default platform configuration:

```js
import { compile } from '@adguard/filters-compiler';

await compile(
    './filters',      // source filter lists
    './log.txt',      // log file (omit to disable logging)
    './report.txt',   // compilation report
    './platforms',    // platform output directory
    [],               // includedFilterIds (empty = compile all)
    [],               // excludedFilterIds (empty = exclude none)
);
```

Compile a single filter into a custom platform:

```js
import { compile } from '@adguard/filters-compiler';

const customPlatformsConfig = {
    // Here you can redefine some of the platforms from platforms.json
    // or add new platforms if you need it.
    MAC_V3: {
        platform: 'mac',
        path: 'mac_v3',
        configuration: {
            ignoreRuleHints: false,
            removeRulePatterns: [
                '^\\/.*', // drop regex rules
            ],
            replacements: [
                { from: 'regex', to: 'repl' },
            ],
        },
        defines: {
            adguard: true,
            adguard_app_mac: true,
        },
    },
};

await compile(
    './filters',
    undefined,          // no log file
    './report.txt',
    './platforms',
    [1],                // only filter ID 1
    [],
    customPlatformsConfig,
);
```

### Validating built filters

After compiling, validate the built output against the bundled schemas:

```js
import { validateJSONSchema } from '@adguard/filters-compiler';

// Each platform build must contain at least 50 filters
const valid = validateJSONSchema('./platforms', 50);
if (!valid) {
    throw new Error('Schema validation failed, see log for details');
}
```

### Validating locale translations

```js
import { validateLocales } from '@adguard/filters-compiler';

const result = validateLocales('./locales', ['en', 'fr', 'ko']);
if (!result.ok) {
    console.error(result.log);
}
```

## <a name="include-directive"></a> `@include` directive and its options

The `@include` directive provides the ability to include content from
the specified address. Filter source files use it to pull in content
from other files or remote URLs during compilation, letting you compose
filter lists from shared fragments.

### Syntax

```text
@include <filepath> [<options>]
```

- `<filepath>` — required, URL or same-origin relative file path to
  include.
- `<options>` — optional, space-separated flags:

    - `/stripComments` — removes AdBlock-style comment lines (starting
      with `!`) from the included file.
    - `/notOptimized` — adds a `!+ NOT_OPTIMIZED` hint to the rules.
    - `/exclude="<filepath>"` — excludes rules listed in the exception
      file at `filepath`.
    - `/addModifiers="<modifiers>"` — appends the given modifiers (as
      is) to every rule in the included file. Works with host-rule
      files too, converting `#` host-file comments to `!` AdBlock-style
      comments.
    - `/ignoreTrustLevel` — skips the trust-level check for the
      included file. Only allowed for same-origin files.
    - `/optimizeDomainBlockingRules` — removes redundant
      domain-blocking rules. Rules with modifiers and rules of other
      formats are ignored.

> [!IMPORTANT]
> Options are applied in the order they appear in the directive, except
> `/ignoreTrustLevel`.

### Examples

Apply all options to an included file:

<!-- markdownlint-disable line-length -->
```adblock
@include ../input.txt /addModifiers="script" /exclude="../exclusions.txt" /notOptimized /stripComments /optimizeDomainBlockingRules
```
<!-- markdownlint-enable line-length -->

Given `../input.txt`:

```adblock
# comment
example.com
example.org
```

**1. `/addModifiers="script"`** appends `$script` to every rule and
converts host-file `#` comments to AdBlock-style `!`:

```adblock
! comment
example.com$script
example.org$script
```

**2. `/exclude="../exclusions.txt"`** removes rules listed in
`exclusions.txt` (for example, `example.com$script`):

```adblock
! comment
example.org$script
```

**3. `/notOptimized`** adds the hint:

```adblock
! comment
!+ NOT_OPTIMIZED
example.org$script
```

**4. `/stripComments`** removes comment lines:

```adblock
!+ NOT_OPTIMIZED
example.org$script
```

**5. `/optimizeDomainBlockingRules`** removes redundant domain-blocking
rules. For example, when `||sub.example.com^` is already covered by
`||example.com^`, it is dropped, while rules with modifiers such as
`||test.com^$script` are kept:

```adblock
||example.com^
||domain.com^
||test.com^$script
```

Include a remote file with comment stripping:

```adblock
@include "https://easylist.github.io/easylist/easylist.txt" /stripComments
```

Skip the trust-level check for a same-origin included file:

```adblock
@include ./input.txt /ignoreTrustLevel
```

## Configuration

### Custom platforms

Pass `customPlatformsConfig` to `compile()` to redefine existing
platforms or add new ones. Each entry mirrors the structure in
`src/main/platforms-config.js`:

```js
const customPlatformsConfig = {
    MAC_V3: {
        platform: 'mac',           // platform family
        path: 'mac_v3',            // output subdirectory under platformsPath
        expires: '12 hours',       // optional cache TTL written to metadata
        configuration: {
            ignoreRuleHints: false, // honour `!+ HINT` hints when false
            removeRulePatterns: [   // regexes of rules to drop
                '^\\/.*',
            ],
            replacements: [        // regex replacements applied to rules
                { from: 'regex', to: 'repl' },
            ],
        },
        defines: {                  // !#if preprocessor flags for this platform
            adguard: true,
            adguard_app_mac: true,
        },
    },
};
```

`replacements[].from` is treated as a regular-expression pattern (it is
passed to `new RegExp(from, 'g')`), not as literal text. Escape regex
meta characters in `from` when a literal match is intended.

### Logging

The compiler writes a timestamped log file when `logPath` is passed to
`compile()`. If `logPath` is omitted, no log file is written. The parent
directory is created automatically when it does not exist.

Log levels:

- `INFO` — general information about the process
- `WARN` — warnings that do not stop the process
- `ERROR` — errors indicating failures

### Environment variables

| Variable | Default           | Purpose                                                                                           |
| -------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| `TLS`    | (system defaults) | Set to `insecure` to bypass TLS certificate verification when downloading external filter sources |

## Supported platforms

The compiler ships built-in configurations for the following platforms.
Each writes its output to a subdirectory under `platformsPath`.

| Platform ID                         | Output directory                    | Target                                    |
| ----------------------------------- | ----------------------------------- | ----------------------------------------- |
| `WINDOWS`                           | `windows`                           | AdGuard for Windows                       |
| `MAC`                               | `mac`                               | AdGuard for macOS (legacy v1)             |
| `MAC_V2`                            | `mac_v2`                            | AdGuard for macOS v2                      |
| `MAC_V3`                            | `mac_v3`                            | AdGuard for macOS v3                      |
| `ANDROID`                           | `android`                           | AdGuard for Android                       |
| `IOS`                               | `ios`                               | AdGuard for iOS                           |
| `CLI`                               | `cli`                               | AdGuard CLI / CoreLibs                    |
| `EXTENSION_CHROMIUM`                | `extension/chromium`                | AdGuard Browser Extension (Chromium, MV2) |
| `EXTENSION_CHROMIUM_MV3`            | `extension/chromium-mv3`            | AdGuard Browser Extension (Chromium, MV3) |
| `EXTENSION_EDGE`                    | `extension/edge`                    | AdGuard Browser Extension (Edge, MV2)     |
| `EXTENSION_OPERA`                   | `extension/opera`                   | AdGuard Browser Extension (Opera, MV2)    |
| `EXTENSION_OPERA_MV3`               | `extension/opera-mv3`               | AdGuard Browser Extension (Opera, MV3)    |
| `EXTENSION_FIREFOX`                 | `extension/firefox`                 | AdGuard Browser Extension (Firefox)       |
| `EXTENSION_SAFARI`                  | `extension/safari`                  | AdGuard Browser Extension (Safari)        |
| `EXTENSION_ANDROID_CONTENT_BLOCKER` | `extension/android-content-blocker` | AdGuard content blocker (Android)         |
| `EXTENSION_UBLOCK`                  | `extension/ublock`                  | uBlock Origin-compatible output           |

## Local Optimization Statistics

`localOptimizationStatistics` provides a workflow for caching optimization statistics
locally so that `compile()` reads each filter's `stats.json` from disk instead of fetching it
from the remote server. `percent.json` (which determines which filters are optimizable) is
always fetched remotely, even when using the local cache.

### Directory layout

```text
<basePath>/
  filters/
    <filterId>/
      stats.json                 # per-filter hit counts (STATS_JSON)
```

### Workflow

1. Call `download(basePath, includedFilterIds, excludedFilterIds)` to save
   `stats.json` for filters listed in the remote `percent.json`.
   `includedFilterIds` limits processing to those IDs (default `[]` = all).
   `excludedFilterIds` skips those IDs (default `[]` = none). The two cannot use both.
2. Call `use(basePath)` before `compile()` to tell
   `getOptimizationStatistics` to read stats from local files under
   `basePath` instead of fetching from the remote server.
3. Call `reset(basePath)` when done to remove the cache directory and clear
   in-memory state.

If stats for a filter can't be retrieved (missing local file, or a failed remote
fetch), `getOptimizationStatistics` throws `OptimizationStatsError` — an `Error`
subclass carrying `filterId` and `sourcePath` fields, so callers can build their
own actionable message instead of matching on `error.message`.

```js
import { localOptimizationStatistics } from '@adguard/filters-compiler';

// 1. Download stats for all optimizable filters to ./stats-cache
await localOptimizationStatistics.download('./stats-cache');

// 2. Tell compile() to read stats from the local cache
localOptimizationStatistics.use('./stats-cache');
await compile('./filters', undefined, undefined, './platforms', [], []);

// 3. Clean up when done
await localOptimizationStatistics.reset('./stats-cache');
```

## Documentation

- [Development](DEVELOPMENT.md) — setup, build, and contributing workflow
- [Deployment and configuration](DEPLOYMENT.md) — release pipeline and runtime environment
- [Changelog](CHANGELOG.md) — version history
- [LLM agent rules](AGENTS.md) — AI-assisted development guidelines

[FiltersRegistry]: https://github.com/AdguardTeam/FiltersRegistry/
[filters-metadata]: https://github.com/AdguardTeam/FiltersRegistry/blob/master/README.md#filters-metadata
[AdGuardSoftwareLimited/ext-compiler]: https://github.com/AdGuardSoftwareLimited/ext-compiler
[AdguardTeam/FiltersCompiler]: https://github.com/AdguardTeam/FiltersCompiler
