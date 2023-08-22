# Filters Compiler Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v1.1.94] - 2023-08-22

### Changed

- Updated TSUrlFilter to v2.1.10
- Updated Scriptlets to v1.9.70

## [v1.1.93] - 2023-07-27

### Changed

- Updated Scriptlets to v1.9.58


## [v1.1.92] - 2023-07-21

### Changed

- Updated TSUrlFilter to v2.1.5
- Updated Scriptlets to v1.9.57


## [v1.1.90] - 2023-07-11

### Changed

- Throw an error during ADG→UBO conversion of scriptlets rule with `$path` modifier


## [v1.1.88] - 2023-06-26

### Changed

- Updated `platforms.json` and added `adguard_ext_chromium` into `defines` for `EXTENSION_EDGE` and `EXTENSION_OPERA`.
- Updated TSUrlFilter to v2.1.3


## [v1.1.86] - 2023-06-15

### Changed

- Updated TSUrlFilter to v2.1.2


## [v1.1.85] - 2023-06-15

### Changed

- Updated Scriptlets to v1.9.37
- Updated TSUrlFilter to v2.0.7


## [v1.1.82] - 2023-04-21

### Changed

- Updated ExtendedCss to v2.0.52
- Updated Scriptlets to v1.9.7
- Updated TSUrlFilter to v2.0.3


## [v1.1.79] - 2023-03-09

### Added

- Locales validation `filters_i18n` schema for filter 23


## [v1.1.77] - 2023-03-01

### Added

- Build .js copies of `filters.json` and `filters_i18n.json`


## [v1.1.76] - 2023-02-01

### Changed

- Updated ExtendedCss to v2.0.45
- Updated TSUrlFilter to 1.0.73


## [v1.1.75] - 2023-01-19

### Changed

- Updated Scriptlets to v1.8.2
- Updated TSUrlFilter to 1.0.72


## [v1.1.73] - 2022-12-28

### Changed

- Updated TSUrlFilter to v1.0.68:
    - validation of `$hls` modifier


## [v1.1.72] - 2022-12-27

### Changed

- Updated TSUrlFilter to v1.0.67:
    - validation of `$jsonprune` modifier


## [v1.1.71] - 2022-12-23

### Changed

- Updated ExtendedCss to v2.0.33:
    - `:not()` and `:is()` pseudo-classes with no extended selector arg
        are considered as standard — top DOM node limitation
        [[1]](https://github.com/AdguardTeam/ExtendedCss/#extended-css-not-limitations)
        [[2]](https://github.com/AdguardTeam/ExtendedCss/#extended-css-is-limitations)
    -  validation of CSS selectors due to related third-party bugs [nwsapi#55](https://github.com/dperini/nwsapi/issues/55)
        and [nwsapi#71](https://github.com/dperini/nwsapi/issues/71)
- Updated Scriptlets to v1.7.19
- Updated TSUrlFilter to 1.0.66

### Added

- Conversion for `google-ima3` redirect [#167](https://github.com/AdguardTeam/FiltersCompiler/issues/167)

### Removed

- Support of `$webrtc` modifier


## [v1.1.69] - 2022-12-19

### Changed

- Updated Scriptlets to v1.7.14
- Updated TSUrlFilter to 1.0.64


## [v1.1.68] - 2022-12-14

### Changed

- Updated Scriptlets to v1.7.13
- Updated TSUrlFilter to 1.0.63


## [v1.1.67] - 2022-12-06

### Changed

- Updated ExtendedCss to v2.0.24
- Updated Scriptlets to v1.7.10
- Updated TSUrlFilter to 1.0.57


## [v1.1.66] - 2022-12-01

### Changed

- Updated ExtendedCss to v2.0.18


## [v1.1.65] - 2022-11-29

### Changed

- Updated ExtendedCss to v2.0.15


## [v1.1.64] - 2022-11-28

### Changed

- Updated ExtendedCss to v2.0.12


## [v1.1.63] - 2022-11-22

### Added

* Support of Trusted scriptlets and their exclusion from list which trust-level is not `full`

### Changed

- Updated TSUrlFilter to v1.0.51, Scriptlets to v1.7.3


[v1.1.94]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.93...v1.1.94
[v1.1.93]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.92...v1.1.93
[v1.1.92]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.90...v1.1.92
[v1.1.90]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.88...v1.1.90
[v1.1.88]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.86...v1.1.88
[v1.1.86]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.85...v1.1.86
[v1.1.85]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.82...v1.1.85
[v1.1.82]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.79...v1.1.82
[v1.1.79]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.77...v1.1.79
[v1.1.77]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.76...v1.1.77
[v1.1.76]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.75...v1.1.76
[v1.1.75]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.73...v1.1.75
[v1.1.73]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.72...v1.1.73
[v1.1.72]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.71...v1.1.72
[v1.1.71]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.69...v1.1.71
[v1.1.69]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.68...v1.1.69
[v1.1.68]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.67...v1.1.68
[v1.1.67]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.66...v1.1.67
[v1.1.66]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.65...v1.1.66
[v1.1.65]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.64...v1.1.65
[v1.1.64]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.63...v1.1.64
[v1.1.63]: https://github.com/AdguardTeam/FiltersCompiler/compare/v1.1.61...v1.1.63
