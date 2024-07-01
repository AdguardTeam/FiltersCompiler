# Filters Compiler Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [v1.1.140] - 2024-07-01

### Fixed

- Adding filters i18n metadata due to `platformsIncluded` and `platformsExcluded`

[v1.1.140]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.139...v1.1.140


## [v1.1.139] - 2024-06-21

### Added

- Support of `ext_chromium_mv3` platform

### Fixed

- Do not build filters due to `platformsIncluded` and `platformsExcluded`
  if limited list of filters are specified to build

[v1.1.139]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.138...v1.1.139


## [v1.1.138] - 2024-06-21

### Added

- `downloadUrl` to generated filters metadata

### Fixed

- Return the rules in their original order after applying the `@include` directive option `/optimizeDomainBlockingRules` [#217]

[v1.1.138]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.136...v1.1.138


## [v1.1.136] - 2024-05-22

### Changed

- Updated [@adguard/filters-downloader] to v2.2.1

[v1.1.136]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.135...v1.1.136


## [v1.1.135] - 2024-05-20

### Added

- New `@include` directive option `/optimizeDomainBlockingRules` [#217]

### Removed

- `fs-extra` from package dependencies

### Fixed

- Filtering of duplicates modifiers during the `@include` directive's `/addModifiers` option applying [#218]

[v1.1.135]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.131...v1.1.135
[#217]: https://github.com/AdguardTeam/FiltersCompiler/issues/217
[#218]: https://github.com/AdguardTeam/FiltersCompiler/issues/218


## [v1.1.131] - 2024-04-05

### Fixes

- Ensure report file is created before writing to it

[v1.1.131]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.130...v1.1.131


## [v1.1.130] - 2024-04-04

### Changed

- Improved report file logging

[v1.1.130]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.129...v1.1.130


## [v1.1.129] - 2024-04-03

### Changed

- Updated [@adguard/tsurlfilter] to v2.2.19:
    - validation of `$header` modifier

### Fixed

- Error during large filter list compiling

[v1.1.129]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.127...v1.1.129


## [v1.1.127] - 2024-03-29

### Changed

- Updated [@adguard/scriptlets] to v1.10.25
- Updated [@adguard/tsurlfilter] to v2.2.17

### Fixed

- UBO→ADG conversion of `$remove$` scriptlet param [#205]

[v1.1.127]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.123...v1.1.127
[#205]: https://github.com/AdguardTeam/FiltersCompiler/issues/205


## [v1.1.123] - 2024-02-13

### Changed

- Updated [@adguard/scriptlets] to v1.10.1
- Updated [@adguard/tsurlfilter] to v2.2.13

## Fixed

- Issue with excluding CSS rules and rules with the `$removeparam` modifier
  if its value contains part of the other modifier

[v1.1.123]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.121...v1.1.123


## [v1.1.121] - 2023-12-15

## Added

- New `@include` directive option `/ignoreTrustLevel` [#202]

## Changed

- Sort filters by filterId in `filters.json` and `filters.js` [#195]

[v1.1.121]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.119...v1.1.121
[#202]: https://github.com/AdguardTeam/FiltersCompiler/issues/202
[#195]: https://github.com/AdguardTeam/FiltersCompiler/issues/195


## [v1.1.119] - 2023-12-06

### Added

- FiltersCompiler ignore uBO exception rules with $important modifier [#200]

### Changed

- Updated [@adguard/extended-css] to v2.0.56
- Updated [@adguard/tsurlfilter] to v2.2.7
- Updated [@adguard/scriptlets] to v1.9.101

[v1.1.119]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.115...v1.1.119
[#200]: https://github.com/AdguardTeam/FiltersCompiler/issues/200


## [v1.1.115] - 2023-11-21

### Added

- Ability to override metadata's expires value for specific platforms [#198]
- Default expires value "12 hours" for `mac_v2` and `windows`

### Changed

- Exclude `#@%#` scripts exceptions from uBO filter lists [#199]
- Exclude unsupported modifiers for `ext_safari`, `ios`, and `ext_android_cb` platforms [#201]

[v1.1.115]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.107...v1.1.115
[#198]: https://github.com/AdguardTeam/FiltersCompiler/issues/198
[#199]: https://github.com/AdguardTeam/FiltersCompiler/issues/199
[#201]: https://github.com/AdguardTeam/FiltersCompiler/issues/201

## [v1.1.107] - 2023-11-13

### Changed

- Updated [@adguard/filters-downloader] to v1.1.23
- Updated [@adguard/tsurlfilter] to v2.2.5
- Updated [@adguard/scriptlets] to v1.9.91

### Fixed

- Filtering of empty lines during the `@include` directive's `/addModifiers` option applying

[v1.1.107]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.105...v1.1.107


## [v1.1.105] - 2023-11-10

### Added

- New `@include` directive option `/addModifiers` [#190]

### Changed

- Implemented the ability to apply modifiers based on their sequential order in the line.

[v1.1.105]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.104...v1.1.105
[#190]: https://github.com/AdguardTeam/FiltersCompiler/issues/190


## [v1.1.104] - 2023-11-08

### Changed

- Updated [@adguard/tsurlfilter] to v2.2.4

[v1.1.104]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.102...v1.1.104


## [v1.1.102] - 2023-11-03

### Changed

- Updated [@adguard/tsurlfilter] to v2.2.3
- Updated [@adguard/scriptlets] to v1.9.83

[v1.1.102]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.101...v1.1.102


## [v1.1.101] - 2023-10-20

### Changed

- Updated [@adguard/filters-downloader] to v1.1.21.

[v1.1.101]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.100...v1.1.101


## [v1.1.100] - 2023-10-11

### Changed

- Updated [@adguard/filters-downloader] to v1.1.20.

[v1.1.100]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.96...v1.1.100


## [v1.1.96] - 2023-08-25

### Changed

- Updated [@adguard/tsurlfilter] to v2.1.11
- Updated [@adguard/scriptlets] to v1.9.72

[v1.1.96]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.94...v1.1.96


## [v1.1.94] - 2023-08-22

### Changed

- Updated [@adguard/tsurlfilter] to v2.1.10
- Updated [@adguard/scriptlets] to v1.9.70

[v1.1.94]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.93...v1.1.94


## [v1.1.93] - 2023-07-27

### Changed

- Updated [@adguard/scriptlets] to v1.9.58

[v1.1.93]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.92...v1.1.93


## [v1.1.92] - 2023-07-21

### Changed

- Updated [@adguard/tsurlfilter] to v2.1.5
- Updated [@adguard/scriptlets] to v1.9.57

[v1.1.92]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.90...v1.1.92


## [v1.1.90] - 2023-07-11

### Changed

- Throw an error during ADG→UBO conversion of scriptlets rule with `$path` modifier

[v1.1.90]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.88...v1.1.90


## [v1.1.88] - 2023-06-26

### Changed

- Updated `platforms.json` and added `adguard_ext_chromium` into `defines` for `EXTENSION_EDGE` and `EXTENSION_OPERA`.
- Updated [@adguard/tsurlfilter] to v2.1.3

[v1.1.88]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.86...v1.1.88


## [v1.1.86] - 2023-06-15

### Changed

- Updated [@adguard/tsurlfilter] to v2.1.2

[v1.1.86]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.85...v1.1.86


## [v1.1.85] - 2023-06-15

### Changed

- Updated [@adguard/scriptlets] to v1.9.37
- Updated [@adguard/tsurlfilter] to v2.0.7

[v1.1.85]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.82...v1.1.85


## [v1.1.82] - 2023-04-21

### Changed

- Updated [@adguard/extended-css] to v2.0.52
- Updated [@adguard/scriptlets] to v1.9.7
- Updated [@adguard/tsurlfilter] to v2.0.3

[v1.1.82]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.79...v1.1.82


## [v1.1.79] - 2023-03-09

### Added

- Locales validation `filters_i18n` schema for filter 23

[v1.1.79]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.77...v1.1.79


## [v1.1.77] - 2023-03-01

### Added

- Build .js copies of `filters.json` and `filters_i18n.json`

[v1.1.77]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.76...v1.1.77


## [v1.1.76] - 2023-02-01

### Changed

- Updated [@adguard/extended-css] to v2.0.45
- Updated [@adguard/tsurlfilter] to 1.0.73

[v1.1.76]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.75...v1.1.76


## [v1.1.75] - 2023-01-19

### Changed

- Updated [@adguard/scriptlets] to v1.8.2
- Updated [@adguard/tsurlfilter] to 1.0.72

[v1.1.75]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.73...v1.1.75


## [v1.1.73] - 2022-12-28

### Changed

- Updated [@adguard/tsurlfilter] to v1.0.68:
    - validation of `$hls` modifier

[v1.1.73]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.72...v1.1.73


## [v1.1.72] - 2022-12-27

### Changed

- Updated [@adguard/tsurlfilter] to v1.0.67:
    - validation of `$jsonprune` modifier

[v1.1.72]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.71...v1.1.72


## [v1.1.71] - 2022-12-23

### Changed

- Updated [@adguard/extended-css] to v2.0.33:
    - `:not()` and `:is()` pseudo-classes with no extended selector arg
        are considered as standard — top DOM node limitation [[1]] [[2]]
    -  validation of CSS selectors due to related third-party bugs [nwsapi#55] and [nwsapi#71]
- Updated [@adguard/scriptlets] to v1.7.19
- Updated [@adguard/tsurlfilter] to 1.0.66

### Added

- Conversion for `google-ima3` redirect [#167]

### Removed

- Support of `$webrtc` modifier

[v1.1.71]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.69...v1.1.71
[1]: https://github.com/AdguardTeam/ExtendedCSS/#extended-css-not-limitations
[2]: https://github.com/AdguardTeam/ExtendedCSS/#extended-css-is-limitations
[nwsapi#55]: https://github.com/dperini/nwsapi/issues/55
[nwsapi#71]: https://github.com/dperini/nwsapi/issues/71
[#167]: https://github.com/AdguardTeam/FiltersCompiler/issues/167


## [v1.1.69] - 2022-12-19

### Changed

- Updated [@adguard/scriptlets] to v1.7.14
- Updated [@adguard/tsurlfilter] to 1.0.64

[v1.1.69]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.68...v1.1.69


## [v1.1.68] - 2022-12-14

### Changed

- Updated [@adguard/scriptlets] to v1.7.13
- Updated [@adguard/tsurlfilter] to 1.0.63

[v1.1.68]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.67...v1.1.68


## [v1.1.67] - 2022-12-06

### Changed

- Updated [@adguard/extended-css] to v2.0.24
- Updated [@adguard/scriptlets] to v1.7.10
- Updated [@adguard/tsurlfilter] to 1.0.57

[v1.1.67]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.66...v1.1.67


## [v1.1.66] - 2022-12-01

### Changed

- Updated [@adguard/extended-css] to v2.0.18

[v1.1.66]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.65...v1.1.66


## [v1.1.65] - 2022-11-29

### Changed

- Updated [@adguard/extended-css] to v2.0.15

[v1.1.65]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.64...v1.1.65


## [v1.1.64] - 2022-11-28

### Changed

- Updated [@adguard/extended-css] to v2.0.12

[v1.1.64]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.63...v1.1.64


## [v1.1.63] - 2022-11-22

### Added

- Support of Trusted scriptlets and their exclusion from list which trust-level is not `full`

### Changed

- Updated [@adguard/tsurlfilter] to v1.0.51
- Updated [@adguard/scriptlets] to v1.7.3

[v1.1.63]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.61...v1.1.63

[@adguard/extended-css]: https://github.com/AdguardTeam/ExtendedCss/blob/master/CHANGELOG.md
[@adguard/filters-downloader]: https://github.com/AdguardTeam/FiltersDownloader/blob/master/CHANGELOG.md
[@adguard/scriptlets]: https://github.com/AdguardTeam/Scriptlets/blob/master/CHANGELOG.md
[@adguard/tsurlfilter]: https://github.com/AdguardTeam/tsurlfilter/blob/master/packages/tsurlfilter/CHANGELOG.md
