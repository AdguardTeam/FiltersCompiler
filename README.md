# AG Filters

## What is AdGuard?

Filters compiler package

### Usage

This package is suggested to be used with filters repository with directory structure presented in tests here.

The package could be run with the following command:

```
 var path = require('path');
 var compiler = require("adguard-filters-compiler");
 
 var filtersDir = path.join(__dirname, './filters');
 var logPath = path.join(__dirname, './log.txt');
 var domainBlacklistFile = path.join(__dirname, './domainBlacklistFile.txt');
 compiler.compile(filtersDir, logPath, domainBlacklistFile);
```

## Tests

```
npm test
```