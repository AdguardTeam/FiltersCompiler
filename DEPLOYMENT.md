# Deployment — @adguard/filters-compiler

- [Deployment Summary](#deployment-summary)
- [Release Pipeline](#release-pipeline)
    - [Prepare Release](#prepare-release)
    - [Publish Release](#publish-release)
    - [Mirror to Public Repository](#mirror-to-public-repository)
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

Releases follow the shared [ext-shared-actions][ext-shared-actions] pipeline
documented in
[publish-release.md](https://github.com/AdGuardSoftwareLimited/ext-shared-actions/blob/master/docs/publish-release.md).

### Prepare Release

The `prepare-release.yml` workflow is triggered manually by a maintainer
with a target tag (e.g. `v3.3.0`). It calls
`AdGuardSoftwareLimited/actions/.github/workflows/create-release-pr.yml@master`
to:

1. Move `[Unreleased]` changelog entries under a new version heading.
2. Create a fresh empty `[Unreleased]` section.
3. Open a release-bump PR against `master`.

After the release-bump PR is reviewed and merged, the publish workflow
takes over automatically.

### Publish Release

The `publish-release.yml` workflow fires when the release-bump PR is merged
into `master`, or can be re-triggered manually via `workflow_dispatch` with
a specific ref.

It calls
`AdGuardSoftwareLimited/ext-shared-actions/.github/workflows/publish-release.yml@master`
to:

1. **Determine the version** — extracted from `CHANGELOG.md` by the shared
   `tag-from-changelog` action. The version is NOT stored in `package.json`;
   it is injected at build time.
2. **Tag the release commit** with the extracted version.
3. **Build and test** inside Docker (`test-output` and `build-output` stages).
4. **Publish to npm** via OIDC trusted publishing (no token required).
   The publish job requires approval from the `npm` GitHub environment.
5. **Mirror** the release tag to the public `AdguardTeam/FiltersCompiler` repo.
6. **Create a draft GitHub Release** with the changelog entries.
7. **Notify Slack** (`#adguard-extension-vcs`) about the new release.

**Permissions required:**

- `contents: write` — create tag and GitHub Release.
- `id-token: write` — OIDC trusted publishing to npm, and Octopass for mirroring.
- `actions: write` — disable/enable workflows in the public mirror repo.

### Mirror to Public Repository

The `mirror.yml` workflow runs on every push to `master` and mirrors all
commits to `git@github.com:AdguardTeam/FiltersCompiler.git` via the shared
`AdGuardSoftwareLimited/actions/.github/workflows/mirror.yml@master` workflow.

**Permissions required:**

- `contents: read` — checkout the source repo.
- `actions: write` — disable workflows in the public mirror.
- `id-token: write` — Octopass OIDC token for pushing to the public repo.

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
