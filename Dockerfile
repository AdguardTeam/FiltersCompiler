# Multi-stage Dockerfile for filters-compiler
# Dependencies are cached until package.json/pnpm-lock.yaml change
# Each stage can be built independently via --target

FROM adguard/node-ssh:22.22--0 AS base
SHELL ["/bin/bash", "-lc"]

# Install specific pnpm version for deterministic builds
RUN npm install -g pnpm@10.7.1

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
# Stage: lint
# Runs all linting (eslint + tsc)
# ============================================================================
FROM source AS lint

ARG BUILD_RUN_ID=""

RUN --mount=type=cache,target=/pnpm-store,id=compiler-pnpm \
    echo "${BUILD_RUN_ID}" > /tmp/.build-run-id && \
    pnpm lint && \
    mkdir -p /out && \
    touch /out/lint.txt

FROM scratch AS lint-output
COPY --from=lint /out/ /

# ============================================================================
# Stage: test
# Builds the package and runs vitest unit tests
# ============================================================================
FROM source AS test

ARG BUILD_RUN_ID=""

RUN --mount=type=cache,target=/pnpm-store,id=compiler-pnpm \
    echo "${BUILD_RUN_ID}" > /tmp/.build-run-id && \
    pnpm build && \
    pnpm test && \
    mkdir -p /out && \
    touch /out/test.txt

FROM scratch AS test-output
COPY --from=test /out/ /

# ============================================================================
# Stage: full-build
# Builds the library, generates build.txt, and creates the npm package tarball
# ============================================================================
FROM source AS full-build

ARG BUILD_RUN_ID=""

RUN --mount=type=cache,target=/pnpm-store,id=compiler-pnpm \
    echo "${BUILD_RUN_ID}" > /tmp/.build-run-id && \
    pnpm build && \
    pnpm build-txt && \
    pnpm pack --out filters-compiler.tgz && \
    mkdir -p /out/artifacts && \
    mv filters-compiler.tgz /out/artifacts/ && \
    cp dist/build.txt /out/artifacts/

FROM scratch AS full-build-output
COPY --from=full-build /out/ /
