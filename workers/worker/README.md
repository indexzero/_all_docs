# @_all_docs/worker

Cross-runtime worker package for distributed npm registry operations.

## Overview

This package provides a unified interface for running npm registry operations across different JavaScript runtimes:
- Node.js processes (local workers)
- Cloudflare Workers
- Fastly Compute@Edge

## Structure

```
worker/
├── app.js          # Main Hono application
├── http/           # HTTP client abstractions
├── storage/        # Storage abstractions (filesystem, KV stores)
├── queue/          # Work queue implementations
├── processors/     # Work item processors
├── runtime/        # Runtime detection and configuration
└── types.js        # TypeScript-style type definitions
```

## Usage

This package is designed to be built for different target environments:

```bash
# Build for all targets
pnpm build

# Build for Cloudflare Workers
pnpm build:cf

# Build for Fastly Compute@Edge
pnpm build:fastly
```

## Development

The package uses:
- **Hono** for cross-runtime HTTP handling
- **unenv** for Node.js API polyfills in edge environments
- **p-queue** and **BullMQ** for work distribution
- Native fetch API with compatibility layers

## Types

Key types are defined in `types.js`:
- `WorkerEnv` - Runtime environment configuration
- `WorkItem` - Work item structure
- `WorkResult` - Work result structure