# Changelog

All notable changes to `@_all_docs` are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.1](https://github.com/indexzero/_all_docs/compare/@_all_docs/cli@0.1.0...HEAD) (2026-02-02)

Major feature release with Views system, enhanced CLI, and multi-runtime support.

### Highlights

- New **Views** system for dataset analysis and querying
- **Checkpoint support** for resumable batch operations
- **Custom remotes** via npmrc or CLI for enterprise registries
- **Local directory storage driver** for virtual cache mounts
- **Multi-runtime support** including CloudRun, Cloudflare Workers, and Fastly

### New Features

#### Views System

- `view query` command with `--format` option for flexible output ([#24](https://github.com/indexzero/_all_docs/pull/24))
- `view enrich` command for NDJSON enrichment pipelines ([#25](https://github.com/indexzero/_all_docs/pull/25))
- Materialized views for analyzing cached metadata ([#21](https://github.com/indexzero/_all_docs/pull/21))

#### CLI Commands

- `packument show` with field projection support ([#22](https://github.com/indexzero/_all_docs/pull/22))
- `cache clear` for cache management ([#18](https://github.com/indexzero/_all_docs/pull/18))
- `packument fetch-list` now supports checkpoints for resumable fetches ([#16](https://github.com/indexzero/_all_docs/pull/16))

#### Cache

- Local directory storage driver for virtual cache mounts ([#23](https://github.com/indexzero/_all_docs/pull/23))
- Readable origin keys replacing truncated base64 ([#17](https://github.com/indexzero/_all_docs/pull/17))
- Cross-platform cache key support

#### Configuration

- Custom remotes via `.npmrc` files or CLI arguments ([#15](https://github.com/indexzero/_all_docs/pull/15))

### Bug Fixes

- Prevent bloom filter from rejecting reads on existing caches ([#20](https://github.com/indexzero/_all_docs/pull/20))
- Preserve URL path segments when constructing packument request URLs ([#19](https://github.com/indexzero/_all_docs/pull/19))
- Skip unscoped packages in analysis summary
- Exclude deleted packages from final name lists
- Fix circular dependencies between packages

### Infrastructure

- Node.js 24 support (ahead of LTS)
- Google CloudRun worker support
- Cloudflare Workers test improvements with mock processor
- Post-August 2025 benchmarking baseline ([#13](https://github.com/indexzero/_all_docs/pull/13))

### Internal

- Major refactoring across Phases 0-4 following ADR specifications
- Improved separation of concerns
- Enhanced test coverage and fixtures

---

## [0.1.0](https://github.com/indexzero/_all_docs/compare/0.0.3...@_all_docs/cli@0.1.0) (2025-08-05)

Complete architectural restructure transforming the project into a pnpm monorepo.

### Breaking Changes

- Migrated from single package to pnpm workspace monorepo
- Import paths changed to scoped packages (e.g., `@_all_docs/cache`, `@_all_docs/partition`)
- Individual bin scripts removed in favor of unified CLI

### Package Architecture

New dedicated packages with clear separation of concerns:

- `@_all_docs/cache` - Core cache management functionality
- `@_all_docs/config` - Centralized configuration management
- `@_all_docs/partition` - B-tree partition logic and client
- `@_all_docs/packument` - Package document handling
- `@_all_docs/exec` - Execution utilities (map/reduce operations)
- `@_all_docs/frame` - Frame utilities for data processing
- `@_all_docs/cli` - Unified command-line interface

### Developer Experience

- Unified CLI via `npx _all_docs` with structured command hierarchy
- Changesets integration for automated version management
- GitHub Actions CI/CD pipeline for testing and releases
- Package-level test suites for improved testability

### Co-authored by

Claude (claude@anthropic.com)

---

## [0.0.3](https://github.com/indexzero/_all_docs/compare/0.0.2...0.0.3) (2025-04-03)

Critical fix release responding to npm registry API changes.

### Breaking Changes (External)

- npm announced deprecation of replication APIs ([changelog](https://github.blog/changelog/2025-02-27-changes-and-deprecation-notice-for-npm-replication-apis))

### Bug Fixes

- Switched all packument requests to use `registry.npmjs.com` to comply with npm's updated API requirements

### Infrastructure

- Added benchmarking for end_key range query technique to measure partition fetch performance

---

## [0.0.2](https://github.com/indexzero/_all_docs/compare/0.0.1...0.0.2) (2025-03-24)

Stabilization release with critical bug fixes and improved observability.

### Bug Fixes

- Fixed URL encoding for scoped npm packages (e.g., `@scope/package`) using `encodeURIComponent`
- Removed errant console.log statements

### Features

- Short operation IDs for tracking concurrent requests
- Map-reduce function implementation following CouchDB/Erlang patterns
- Added `npm-high-impact-json` helper script for package analysis

### Improvements

- Refactored imports to use undici utilities
- Aligned documentation with API structure
- Added test fixtures scaffolding
- Updated dependencies

---

## [0.0.1](https://github.com/indexzero/_all_docs/releases/tag/0.0.1) (2025-03-02)

Initial release establishing the core architecture for fetching and caching CouchDB's `_all_docs` endpoint.

### Features

- B-tree partitioning system using lexographically sorted key ranges
- Partition client for fetching from npm registry
- JSON file caching with `{start_key}__{end_key}.json` naming
- `getPartition`/`writePartition` core primitives
- Packument fetching capability
- Map-reduce infrastructure scaffolding

### Infrastructure

- TypeScript foundation
- Node.js native test runner integration
- p-retry for resilient HTTP requests with automatic retries
- CLI tooling via bin scripts
