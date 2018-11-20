# AG Filters

## What is AdGuard?

Filters compiler package

### Usage

This package is suggested to be used with filters repository with directory structure presented in tests here.

The package could be run with the following command:

```
 const whitelist = [1, 3];
 const blacklist = [2];
 
 const path = require('path');
 const compiler = require("adguard-filters-compiler");
 
 const filtersDir = path.join(__dirname, './filters');
 const logPath = path.join(__dirname, './log.txt');
 const domainBlacklistFile = path.join(__dirname, './domains-blacklist.txt');
 
 const platformsPath = path.join(__dirname, './platforms');
 
 compiler.compile(filtersDir, logPath, domainBlacklistFile, platformsPath, whitelist, blacklist);
```

## Tests

```
 npm test
```