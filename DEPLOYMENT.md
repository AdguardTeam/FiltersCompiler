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

| Workflow              | Trigger                                | Purpose                                                                                       |
| --------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `ci.yml`              | PRs and pushes to `master`             | Lint, test, build in Docker (Node.js 22.22) and on Node.js 24; uploads `filters-compiler.tgz` |
| `prepare-release.yml` | Manual (`workflow_dispatch` with tag)  | Open a release-bump PR that finalizes `CHANGELOG.md`                                          |
| `publish-release.yml` | PR merged to `master` or manual re-run | Tag, build, publish to npm, mirror, create GitHub Release, notify Slack                       |
| `mirror.yml`          | Push to `master`                       | Mirror commits to `AdguardTeam/FiltersCompiler`                                               |

Self-hosted jobs run on the `team-extensions` runner label; the npm publish
job (`deploy-to-npm`) runs on `ubuntu-latest`. Except for the Node.js 24 job
in `ci.yml`, which runs the checks directly via `actions/setup-node`,
workflows reuse the shared pipeline definitions from
[AdGuardSoftwareLimited/ext-shared-actions][ext-shared-actions] and
[AdGuardSoftwareLimited/actions][actions].

**Concurrency**: `ci.yml` uses a concurrency group
`ci-ext-compiler-${{ github.ref }}` with `cancel-in-progress: true` to
prevent redundant CI runs when a new push arrives for the same ref.
`publish-release.yml` uses a `publish-release` group with
`cancel-in-progress: false` to serialize release runs.

## Environment Variables

### `TLS`

- **Required:** No
- **Default:** (system defaults)
- **Purpose:** Set to `insecure` to make `curl` skip TLS certificate
  verification. Only affects `src/main/utils/webutils.ts`. Remote
  `!#include` downloads use `fetch` and follow the Node.js TLS settings:
  `NODE_EXTRA_CA_CERTS` adds a CA, and `NODE_TLS_REJECT_UNAUTHORIZED=0`
  disables verification.

### `NODE_USE_ENV_PROXY`

- **Required:** No
- **Default:** (unset)
- **Purpose:** Set to `1` to let remote `!#include` downloads use a proxy
  from the environment. Node.js reads `HTTP_PROXY` or `http_proxy`,
  `HTTPS_PROXY` or `https_proxy`, and `NO_PROXY` or `no_proxy`. Without
  this variable, `fetch` does not use a proxy. `ALL_PROXY` is not
  supported. `curl` downloads read the same names, except the uppercase
  `HTTP_PROXY`, and also `ALL_PROXY` as a fallback. `http_proxy` applies
  only to `http://` URLs.

`TLS` is the only environment variable that the compiler reads directly.
`NODE_USE_ENV_PROXY` is read by Node.js for `fetch` proxy support. All
CI/CD configuration (such as npm publish tokens, Octopass, and Slack
webhooks) is handled by the shared workflows and does not require
per-project configuration.

## Infrastructure Dependencies

The compiler is a **stateless library** with no database, cache, or message
queue dependencies. The only infrastructure requirement is:

| Dependency | Required | Purpose                                            |
| ---------- | -------- | -------------------------------------------------- |
| **curl**   | Yes      | Downloading external filter sources via shell-out  |

`curl` is invoked synchronously via `child_process.execFileSync` from
`src/main/utils/webutils.ts`. The Docker base image
(`adguard/node-ssh:22.22--0`) includes `curl` by default.

## Logging

The compiler uses `@adguard/logger` with a custom file writer
(`src/main/utils/log.ts`). Messages always go to the console. When a
`logPath` is provided to `compile()`, or `options.logPath` to
`validateJSONSchema()`, messages are also written to that file.

| Aspect        | Details                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| **Framework** | `@adguard/logger` with custom `CompilerLogger` subclass                                                |
| **Output**    | Console, plus a local file when `logPath`/`options.logPath` is set                                     |
| **Format**    | `[timestamp] [LEVEL]: message` (plain text)                                                            |
| **Levels**    | `INFO`, `WARN`, `ERROR`                                                                                |
| **File mode** | `compile()` truncates on open; `validateJSONSchema()` appends and closes the file when validation ends |

If `compile()` gets no `logPath`, no log file is written and it emits a
`Log file is not specified` console warning. If `validateJSONSchema()` gets
no `options.logPath`, it uses the console only and does not reuse a file
opened by an earlier call. The parent directory is created automatically if
it does not exist. There is **no log rotation** and **no remote log
shipping** — log files stay on local disk.

## Integrations

### External Service Dependencies

| Integration                                | Purpose               | Configuration                                                                               |
| ------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------- |
| **npm registry**                           | Package distribution  | OIDC trusted publishing via the `npm` GitHub environment. No long-lived tokens.             |
| **GitHub (`AdguardTeam/FiltersCompiler`)** | Public mirror         | SSH push via Octopass OIDC. Workflows are disabled in the mirror repo.                      |
| **Slack**                                  | Release notifications | `#adguard-extension-vcs` channel. Webhook managed by the shared `publish-release` workflow. |

### External Filter Sources

The compiler downloads external data at runtime:

| Source                                                       | Purpose                 | Transport | Consumer                   |
| ------------------------------------------------------------ | ----------------------- | --------- | -------------------------- |
| `@include` URLs in filter templates                          | Filter sources          | `curl`    | `src/main/builder.js`      |
| `!#include` URLs in filter or `@include` content             | Filter sources          | `fetch`   | `src/main/builder.js`      |
| `https://chrome.adtidy.org/optimization_config/percent.json` | Optimization percentage | `curl`    | `src/main/optimization.ts` |
| `https://chrome.adtidy.org/filters/<filterId>/stats.json`    | Optimization statistics | `curl`    | `src/main/optimization.ts` |

All sources must be reachable at runtime. `https://filters.adtidy.org/` is
not a download source. `src/main/builder.js` uses it only to build the
`downloadUrl` and `subscriptionUrl` fields in the platform metadata.

`TLS=insecure` skips certificate validation for `curl` downloads only. The
`fetch` transport follows the Node.js TLS settings. Set
`NODE_USE_ENV_PROXY=1` to let `fetch` use an HTTP proxy (see
[Environment Variables](#environment-variables)).

## Error Reporting

This project does **not** use an error reporting service (Sentry, Bugsnag,
or equivalent). Errors are written to the local log file via
`CompilerLogger` (see [Logging](#logging)) and surfaced through exceptions
raised to the consumer.

## Docker Build

The `Dockerfile` uses multi-stage builds based on `adguard/node-ssh:22.22--0`:

| Stage                    | Purpose           | Key Steps                                                                    |
| ------------------------ | ----------------- | ---------------------------------------------------------------------------- |
| `base`                   | Shared foundation | Node.js 22.22, pnpm 10.33.4 (from base image)                                |
| `deps`                   | Dependency cache  | `pnpm install --frozen-lockfile --ignore-scripts`                            |
| `source`                 | Full source       | Copies project files over `deps`                                             |
| `test-output`            | Node.js 22.22 CI  | `pnpm run ci`                                                                |
| `build` / `build-output` | Artifact creation | `pnpm build && pnpm pack --out filters-compiler.tgz`; outputs `.tgz` at root |

The dependency stage is cached by `package.json` and `pnpm-lock.yaml`.
The build cache (pnpm store) is mounted at `/pnpm-store` with id `compiler-pnpm`.

### Local Build Commands

```bash
# Run the Node.js 22.22 CI checks (lint + build + test)
docker build --target test-output .

# Produce the release artifact
docker build --platform linux/amd64 --target build-output \
   --build-arg VERSION=0.0.0-dev --output ./artifacts .
# → ./artifacts/filters-compiler.tgz
```

The `test-output` target reproduces only the Node.js 22.22 job. The Node.js 24
job in `ci.yml` runs `pnpm run ci` directly on the runner. Both call the same
`ci` script from `package.json`, so the check set is defined once.

`package.json` intentionally has no `version` field — CI injects the release
version before building the image, and `pnpm pack` requires one. Pass a
placeholder via the `VERSION` build arg for local packaging.

[ext-shared-actions]: https://github.com/AdGuardSoftwareLimited/ext-shared-actions
[actions]: https://github.com/AdGuardSoftwareLimited/actions
