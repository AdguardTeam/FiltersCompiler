# AdGuard Filters Compiler

Filters compiler package is a tool for compiling ad blocking filters into a supported format.
It is used in [FiltersRegistry].

- [Usage](#usage)
- [Tests](#tests)
- [Development](#development)
- [Filters metadata](#filters-metadata)
- [`@include` directive](#include-directive)

### Usage

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

### Tests

```bash
yarn test
```

### Development

In order to add support for new scriptlets and redirects,
you should update `@adguard/tsurlfilter` with updated scriptlets.

For fixing scriptlets converting or validation you should update `scriptlets`.

### Filters metadata

Description of the filters metadata is available in the [FiltersRegistry][filters-metadata] repository.

### <a name="include-directive"></a> `@include` directive and its options

The `@include` directive provides the ability to include content from the specified address.

#### Syntax:

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
      In this case, host-file comments are to be replaced `#` by AdBlock-style syntax comments `!`.

> [!IMPORTANT]
> The content of the included file is formatted by the options due to the order of their mention in the directive.

#### Example:

```adblock
@include ../input.txt /addModifiers="script" /exclude="../exclusions.txt" /notOptimized /stripComments
```

The order of execution of the options is as follows:

1. `@include ../input.txt`: Includes the content of the file named `input.txt` from the parent directory.

    ``` adblock
    # comment
    example.com
    example.org
    ```

1. `/addModifiers="script"`: Adds the `$script` modifier to all rules in the included file.

    Result of adding modifiers:

    ``` adblock
    ! comment
    example.com$script
    example.org$script
    ```

    > Used to restrict rules with modifiers when blocking the entire domain would result in a breakage.
    > [issue example](https://github.com/AdguardTeam/FiltersCompiler/issues/190)

1. `/exclude="../exclusions.txt"`: Excludes rules listed in the exception list from the file named `exclusions.txt`, if they match.

    Due to the content of `exclusions.txt`:

    ``` adblock
    example.com$script
    example2.com$script
    ```

    Result of excluding:

    ``` adblock
    ! comment
    example.org$script
    ```

    > Used to exclude problematic rules in the filter

1. `/notOptimized`: Adds the `!+ NOT_OPTIMIZED` hint to the rules.

    Result of adding the hint:

    ``` adblock
    ! comment
    !+ NOT_OPTIMIZED
    example.org$script
    ```

    > Used in cases where the filter is designed for mobile site layout and some rules may be removed,
    > due to the lack of ability to collect statistics on mobile platforms.

1. `/stripComments`: Removes comments in AdBlock style from the included file.

    ``` adblock
    !+ NOT_OPTIMIZED
    example.org$script
    ```

[FiltersRegistry]: https://github.com/AdguardTeam/FiltersRegistry/
[filters-metadata]: https://github.com/AdguardTeam/FiltersRegistry/blob/master/README.md#filters-metadata
