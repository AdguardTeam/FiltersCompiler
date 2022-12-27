# Filters Compiler Changelog


## v1.1.72

### Changed

- Updated TSUrlFilter to v1.0.67:
    - validation of `$jsonprune` modifier


## v1.1.71

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


## v1.1.69

### Changed

- Updated Scriptlets to v1.7.14
- Updated TSUrlFilter to 1.0.64


## v1.1.68

### Changed

- Updated Scriptlets to v1.7.13
- Updated TSUrlFilter to 1.0.63


## v1.1.67

### Changed

- Updated ExtendedCss to v2.0.24
- Updated Scriptlets to v1.7.10
- Updated TSUrlFilter to 1.0.57


## v1.1.66

### Changed

- Updated ExtendedCss to v2.0.18


## v1.1.65

### Changed

- Updated ExtendedCss to v2.0.15


## v1.1.64

### Changed

- Updated ExtendedCss to v2.0.12


## v1.1.63

### Added

* Support of Trusted scriptlets and their exclusion from list which trust-level is not `full`

### Changed

- Updated TSUrlFilter to v1.0.51, Scriptlets to v1.7.3
