# AdGuard Filters Compiler

Filters compiler package is a tool for compiling ad blocking filters into a supported format.
It is used in [FiltersRegistry].

- [Usage](#usage)
- [Tests](#tests)
- [Development](#development)
    - [Schemas maintenance](#schemas-maintenance)
- [Filters metadata](#filters-metadata)
- [`@include` directive and its options](#include-directive)

## Usage

This package is suggested to be used with filters repository with directory structure presented in tests here.

The package could be run with the following command:

```javascript
const whitelist = [1, 3];
const blacklist = [2];

const path = require('path');
const compiler = require("adguard-filters-compiler");

const filtersDir = path.join(__dirname, './filters');
const logPath = path.join(__dirname, './log.txt');
const reportPath = path.join(__dirname, './report.txt');

const platformsPath = path.join(__dirname, './platforms');

const customPlatformsConfig = {
    // Here you can redefine some of the platforms from platforms.json
    // or add new platforms if you need it.
    "MAC_V3": {
        "platform": "mac",
        "path": "mac_v3",
        "configuration": {
            "ignoreRuleHints": false,
            "removeRulePatterns": [
                "^\\/.*" // remove regex rules for some reason.
            ],
            "replacements": [
                {
                    "from": "regex",
                    "to": "repl"
                }
            ]
        },
        "defines": {
            "adguard": true,
            "adguard_app_mac": true
        }
    },
};

compiler.compile(filtersDir, logPath, reportPath, platformsPath, whitelist, blacklist, customPlatformsConfig);
```

The built filters for the platforms can be validated by schemas.
And there is `validateJSONSchema()` method for that:

```javascript
const compiler = require("adguard-filters-compiler");

const validationResult = compiler.validateJSONSchema(<platformsPath>, <FILTERS_REQUIRED_AMOUNT>);
```

where `<platformsPath>` is the path to the platforms directory
and `<FILTERS_REQUIRED_AMOUNT>` is an expected minimum number of filters.

## Tests

```bash
pnpm test
```

## Development

> No new fields should be added to the metadata files for old `mac` and current `mac_v2` platforms,
> check [generator.js](./src/main/platforms/generator.js) for more details.

In order to add support for new scriptlets and redirects,
you should update `@adguard/tsurlfilter` with updated scriptlets.

For fixing scriptlets converting or validation you should update `@adguard/scriptlets`.

### Schemas maintenance

Schemas which are used for `validateJSONSchema()` method are located in `schemas/` directory:

- `filters.schema.json` — schema for *filters* metadata;
- `filters_i18n.schema.json` — schema for *filters_i18n* metadata.

> Schemas in `schemas/mac/` directory are needed for legacy macOS v1 platform, so they should not be changed.
> The same is true for `schemas/mac_v2/` directory.

If any changes should be made in the schemas, e.g. adding a new locale or filter or tag,
**never edit them directly in `schemas/` manually**.

Instead of that, you should edit scripts in `tasks/build-schemas/` directory
and use the following command to generate the schemas:

```bash
pnpm build-schemas
```

## Filters metadata

Description of the filters metadata is available in the [FiltersRegistry][filters-metadata] repository.

## <a name="include-directive"></a> `@include` directive and its options

The `@include` directive provides the ability to include content from the specified address.

### Syntax

```text
@include <filepath> [<options>]
```

where:

- `<filepath>` — required, URL or same origin relative file path to be included;
- `<options>` — optional, a list of options separated by spaces.
  Available options:

    - `/stripComments` removes AdBlock-style syntax comments from the included file — lines which start with `!`;
    - `/notOptimized` adds a `!+ NOT_OPTIMIZED` hint to the rules;
    - `/exclude="<filepath>"` excludes from the included file rules
      listed in the exceptions file available by `filepath`;
    - `/addModifiers="<modifiers>"` adds the specified `modifiers` (string as is) to the rules in the included file.
      The addModifiers option can also work with the host-rule format files.
      In this case, host-file comments are to be replaced `#` by AdBlock-style syntax comments `!`;
    - `/ignoreTrustLevel` disables the check of the trust level of the included file.
      Allowed only for the same origin files.
    - `/optimizeDomainBlockingRules` remove redundant rules for domain blocking of the included file.
      Base rules with modifiers and rules of other format will be ignored.
      Comments are not checked separately and may not be relevant after optimization.

> [!IMPORTANT]
> The content of the included file is formatted by the options due to the order of their mention in the directive,
> except `/ignoreTrustLevel`.

### Examples

- Include a file with domains, add modifiers to the rules, exclude some rules,
   add a hint to the rules, and remove comments from the prepared rules:

    ```adblock
    @include ../input.txt /addModifiers="script" /exclude="../exclusions.txt" /notOptimized /stripComments /optimizeDomainBlockingRules
    ```

    The order of execution of the options is as follows:

    1. `@include ../input.txt`: Includes the content of the file named `input.txt` from the parent directory.

        ```adblock
        # comment
        example.com
        example.org
        ```

    1. `/addModifiers="script"`: Adds the `$script` modifier to all rules in the included file.

        Result of adding modifiers:

        ```adblock
        ! comment
        example.com$script
        example.org$script
        ```

        > Used to restrict rules with modifiers when blocking the entire domain would result in a breakage.
        > [issue example](https://github.com/AdguardTeam/FiltersCompiler/issues/190)

    1. `/exclude="../exclusions.txt"`: Excludes rules listed in the exception list from the file named `exclusions.txt`, if they match.

        Due to the content of `exclusions.txt`:

        ```adblock
        example.com$script
        example2.com$script
        ```

        Result of excluding:

        ```adblock
        ! comment
        example.org$script
        ```

        > Used to exclude problematic rules in the filter

    1. `/notOptimized`: Adds the `!+ NOT_OPTIMIZED` hint to the rules.

        Result of adding the hint:

        ```adblock
        ! comment
        !+ NOT_OPTIMIZED
        example.org$script
        ```

        > Used in cases where the filter is designed for mobile site layout and some rules may be removed,
        > due to the lack of ability to collect statistics on mobile platforms.

    1. `/stripComments`: Removes comments in AdBlock style from the included file.

        ```adblock
        !+ NOT_OPTIMIZED
        example.org$script
        ```

    1. `/optimizeDomainBlockingRules`: Remove only domain blocking redundant rules from the included file.

        Due to the optimization:

        ```adblock
        ||example.com^
        ||sub.example.com^
        ||domain.com^
        ||test.com^$script
        ```

        Result of optimization:

        ```adblock
        ||example.com^
        ||domain.com^
        ||test.com^$script
        ```

- Ignore the trust level of the filter list (specified in the metadata) during the file including —
  include the file rules as is:

    ```adblock
    @include ./input.txt /ignoreTrustLevel
    ```

[FiltersRegistry]: https://github.com/AdguardTeam/FiltersRegistry/
[filters-metadata]: https://github.com/AdguardTeam/FiltersRegistry/blob/master/README.md#filters-metadata
