# Deployment — @adguard/filters-compiler

- [Deployment Summary](#deployment-summary)
- [Release Pipeline](#release-pipeline)
- [CI/CD](#cicd)
- [Environment Variables](#environment-variables)
- [Infrastructure Dependencies](#infrastructure-dependencies)
- [Logging](#logging)
- [Integrations](#integrations)
- [Error Reporting](#error-reporting)
- [Docker Build](#docker-build)

## Deployment Summary

| Parameter              | Value                          |
|------------------------|--------------------------------|
| **npm package**        | `@adguard/filters-compiler`    |
| **Artifact**           | `filters-compiler.tgz`         |
| **Public mirror**      | `AdguardTeam/FiltersCompiler`  |
| **GitHub environment** | `npm`                          |
| **Slack channel**      | `#adguard-extension-vcs`       |
| **Runner label**       | `team-extensions`              |

## Release Pipeline

Releases follow the shared [ext-shared-actions][ext-shared-actions] pipeline.
For the full step-by-step documentation, see
[publish-release.md](https://github.com/AdGuardSoftwareLimited/ext-shared-actions/blob/master/docs/publish-release.md).

In short:

1. A maintainer runs `prepare-release.yml` manually with a target tag
   (e.g. `v3.3.0`) to open a release-bump PR that finalizes `CHANGELOG.md`.
2. Merging the release-bump PR triggers `publish-release.yml`, which tags
   the release commit, builds and tests in Docker, publishes to npm via OIDC
   trusted publishing (gated by the `npm` GitHub environment), mirrors the
   tag to `AdguardTeam/FiltersCompiler`, creates a GitHub Release with the
   changelog entries (published immediately, not a draft), and notifies
   Slack (`#adguard-extension-vcs`).

## CI/CD

| Workflow              | Trigger                                | Purpose                                                                 |
| --------------------- | -------------------------------------- | ----------------------------------------------------------------------- |
| `ci.yml`              | PRs and pushes to `master`             | Lint, test, build inside Docker; upload `filters-compiler.tgz` artifact |
| `prepare-release.yml` | Manual (`workflow_dispatch` with tag)  | Open a release-bump PR that finalizes `CHANGELOG.md`                    |
| `publish-release.yml` | PR merged to `master` or manual re-run | Tag, build, publish to npm, mirror, create GitHub Release, notify Slack |
| `mirror.yml`          | Push to `master`                       | Mirror commits to `AdguardTeam/FiltersCompiler`                         |

All workflows run on the `team-extensions` runner label and reuse the
shared pipeline definitions from
[AdGuardSoftwareLimited/ext-shared-actions][ext-shared-actions] and
[AdGuardSoftwareLimited/actions][actions].

**Concurrency**: `ci.yml` uses a concurrency group
`ci-ext-compiler-${{ github.ref }}` with `cancel-in-progress: true` to
prevent redundant CI runs when a new push arrives for the same ref.

## Environment Variables

### `TLS`

- **Required:** No
- **Default:** (system defaults)
- **Purpose:** Set to `insecure` to bypass TLS certificate verification
  when downloading external filter sources via `curl`. Only affects
  `src/main/utils/webutils.js`.

This is the only environment variable read at runtime. All CI/CD configuration
(such as npm publish tokens, Octopass, and Slack webhooks) is handled by the
shared workflows and does not require per-project configuration.

## Infrastructure Dependencies

The compiler is a **stateless library** with no database, cache, or message
queue dependencies. The only infrastructure requirement is:

| Dependency | Required | Purpose                                            |
| ---------- | -------- | -------------------------------------------------- |
| **curl**   | Yes      | Downloading external filter sources via shell-out  |

`curl` is invoked synchronously via `child_process.execFileSync` from
`src/main/utils/webutils.js`. The Docker base image
(`adguard/node-ssh:22.22--0`) includes `curl` by default.

## Logging

The compiler uses `@adguard/logger` with a custom file writer
(`src/main/utils/log.js`). Logging is file-based and initialized when the
consumer passes a `logPath` to the `compile()` function.

| Aspect        | Details                                                 |
| ------------- | ------------------------------------------------------- |
| **Framework** | `@adguard/logger` with custom `CompilerLogger` subclass |
| **Output**    | Local file only (`logPath` argument to `compile()`)     |
| **Format**    | `[timestamp] [LEVEL]: message` (plain text)             |
| **Levels**    | `INFO`, `WARN`, `ERROR`                                 |
| **File mode** | Truncate on open, append for subsequent writes          |

If `logPath` is not provided, no log file is written and a console warning
is emitted. The parent directory is created automatically if it does not
exist. There is **no log rotation** and **no remote log shipping** — logs
are written exclusively to local disk.

## Integrations

### External Service Dependencies

| Integration                                | Purpose               | Configuration                                                                               |
| ------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------- |
| **npm registry**                           | Package distribution  | OIDC trusted publishing via the `npm` GitHub environment. No long-lived tokens.             |
| **GitHub (`AdguardTeam/FiltersCompiler`)** | Public mirror         | SSH push via Octopass OIDC. Workflows are disabled in the mirror repo.                      |
| **Slack**                                  | Release notifications | `#adguard-extension-vcs` channel. Webhook managed by the shared `publish-release` workflow. |

### External Filter Sources

The compiler downloads filter lists and optimization data at runtime via `curl`:

| URL                                              | Purpose                                  | Consumer                   |
| ------------------------------------------------ | ---------------------------------------- | -------------------------- |
| `https://filters.adtidy.org/`                    | Base URL for filter list downloads       | `src/main/builder.js`      |
| `https://chrome.adtidy.org/optimization_config/` | Optimization percentage and stats config | `src/main/optimization.js` |

Both services must be reachable at runtime. The `TLS` environment variable
can be set to `insecure` to bypass certificate validation if needed
(see [Environment Variables](#environment-variables)).

## Error Reporting

This project does **not** use an error reporting service (Sentry, Bugsnag,
or equivalent). Errors are written to the local log file via
`CompilerLogger` (see [Logging](#logging)) and surfaced through exceptions
raised to the consumer.

## Docker Build

The `Dockerfile` uses multi-stage builds based on `adguard/node-ssh:22.22--0`:

| Stage                    | Purpose           | Key Steps                                                                    |
| ------------------------ | ----------------- | ---------------------------------------------------------------------------- |
| `base`                   | Shared foundation | Node.js 22, pnpm 10.33.4 (from base image)                                   |
| `deps`                   | Dependency cache  | `pnpm install --frozen-lockfile --ignore-scripts`                            |
| `source`                 | Full source       | Copies project files over `deps`                                             |
| `test` / `test-output`   | CI validation     | `pnpm lint && pnpm build && pnpm test`; outputs `/out/test-passed.txt`       |
| `build` / `build-output` | Artifact creation | `pnpm build && pnpm pack --out filters-compiler.tgz`; outputs `.tgz` at root |

The dependency stage is cached by `package.json` and `pnpm-lock.yaml`.
The build cache (pnpm store) is mounted at `/pnpm-store` with id `compiler-pnpm`.

### Local Build Commands

```bash
# Run CI validation (lint + build + test)
docker build --target test-output .

# Produce the release artifact
docker build --target build-output --output ./artifacts .
# → ./artifacts/filters-compiler.tgz
```

[ext-shared-actions]: https://github.com/AdGuardSoftwareLimited/ext-shared-actions
[actions]: https://github.com/AdGuardSoftwareLimited/actions
