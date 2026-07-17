# Multi-stage Dockerfile for filters-compiler
# Dependencies are cached until package.json/pnpm-lock.yaml change
# Each stage can be built independently via --target

FROM adguard/node-ssh:22.22--0 AS base
SHELL ["/bin/bash", "-lc"]

WORKDIR /compiler

# pnpm store directory — set once here, no need for pnpm config set in every RUN
ENV npm_config_store_dir=/pnpm-store

# ============================================================================
# Stage: deps
# Cached until package.json/pnpm-lock.yaml changes
# ============================================================================
FROM base AS deps

COPY package.json pnpm-lock.yaml ./

# --ignore-scripts: skips husky install (prepare script) which requires a git repo
RUN --mount=type=cache,target=/pnpm-store,id=compiler-pnpm \
    pnpm install \
        --frozen-lockfile \
        --ignore-scripts \
        --prefer-offline

# ============================================================================
# Stage: source
# Cached until source code changes
# Has source + node_modules
# ============================================================================
FROM deps AS source

COPY . /compiler

# ============================================================================
# Stage: test-output
# Runs lint, builds the library, and runs vitest unit tests.
# Used as the CI validation target: `docker build --target test-output .`
# fails if lint, build, or tests fail.
# ============================================================================
FROM source AS test-output

ARG BUILD_RUN_ID=""

RUN --mount=type=cache,target=/pnpm-store,id=compiler-pnpm \
    echo "${BUILD_RUN_ID}" > /tmp/.build-run-id && \
    pnpm lint && \
    pnpm build && \
    pnpm test

# ============================================================================
# Stage: build
# Builds the library and creates the npm package tarball for publishing
# ============================================================================
FROM source AS build

ARG BUILD_RUN_ID=""

RUN --mount=type=cache,target=/pnpm-store,id=compiler-pnpm \
    echo "${BUILD_RUN_ID}" > /tmp/.build-run-id && \
    pnpm build && \
    pnpm pack --out filters-compiler.tgz && \
    mkdir -p /out/artifacts && \
    mv filters-compiler.tgz /out/artifacts/

FROM scratch AS build-output
COPY --from=build /out/artifacts/ /
