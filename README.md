# AG Filters

## What is AdGuard?

Filters compiler package

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

```
 yarn test
```

### Development

In order to add support for new scriptlets and redirects, you should update `@adguard/tsurlfilter` with updated scriptlets.

For fixing scriptlets converting or validation you should update `scriptlets`.

### Filters metadata

[Check the filters metadata information description here](https://github.com/AdguardTeam/FiltersRegistry/blob/master/README.md)
