# Getting Started

Welcome to `@_all_docs/cache`! This guide will help you get up and running with fetching and caching npm registry data using our partition-tolerant system.

## Prerequisites

- Node.js 20+ (for local development)
- pnpm 8+ (for package management)
- ~10GB free disk space (for caching npm data)
- Basic familiarity with npm registry concepts

## Installation

### Quick Start

```bash
# Install globally for CLI access
npm install -g @_all_docs/cli

# Or use directly with npx
npx @_all_docs/cli --help
```

### Development Setup

```bash
# Clone the repository
git clone https://github.com/indexzero/_all_docs.git
cd _all_docs

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build the project
pnpm build
```

## Basic Concepts

### What are Partitions?

The npm registry contains over 3.4 million packages. Fetching all of them at once is impractical. Partitions divide this massive dataset into manageable chunks based on lexicographic sorting.

For example, a partition from "express" to "express-z" contains all packages whose names fall alphabetically within that range.

### What are Pivots?

Pivots are the boundary points that define partitions. A simple set of pivots might be:

```javascript
['a', 'b', 'c', 'd', 'e', 'f']
```

This creates partitions for packages starting with each letter range.

### What are Packuments?

A packument is the full metadata document for an npm package, including all versions, dependencies, and other package.json data.

## Your First Commands

### 1. Create Pivots

First, create a file defining your partition pivots:

```javascript
// pivots.js
module.exports = [
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
  'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
  'u', 'v', 'w', 'x', 'y', 'z'
];
```

### 2. Fetch Partitions

Fetch the `_all_docs` data for your defined partitions:

```bash
# Fetch all partitions based on pivots
npx _all_docs partition refresh --pivots ./pivots.js

# Fetch a specific partition
npx _all_docs partition fetch --start-key "express" --end-key "express-z"
```

The fetched data is automatically cached locally in `./cache/partitions/`.

### 3. Fetch Packuments

Once you have partition data, you can fetch full package documents:

```bash
# Fetch a single packument
npx _all_docs packument fetch express

# Fetch multiple packuments from a list
echo '["express", "react", "vue"]' > packages.json
npx _all_docs packument fetch-list ./packages.json
```

### 4. Work with the Cache

Inspect and manage your local cache:

```bash
# Create an index of all cached partitions
npx _all_docs cache create-index > partition-index.txt

# Export cached data
npx _all_docs cache export ./packages.json ./export-dir

# Validate cache integrity
npx _all_docs cache validate-partitions
```

## Common Use Cases

### Building a Local npm Mirror

```bash
# 1. Define comprehensive pivots (more pivots = smaller partitions)
cat > detailed-pivots.js << 'EOF'
module.exports = [
  null,
  ...Array.from({length: 10}, (_, i) => String(i)),
  ...Array.from({length: 26}, (_, i) => String.fromCharCode(97 + i)),
  ...Array.from({length: 26}, (_, i) => `a${String.fromCharCode(97 + i)}`),
  // Add more prefixes for better distribution
];
EOF

# 2. Fetch all partition metadata
npx _all_docs partition refresh --pivots ./detailed-pivots.js

# 3. Fetch packuments for high-impact packages
curl -o npm-high-impact.json https://example.com/high-impact-packages.json
npx _all_docs packument fetch-list ./npm-high-impact.json
```

### Analyzing Package Dependencies

```javascript
// analyze-deps.js
import { PartitionFrame } from '@_all_docs/frame';
import { createStorageDriver } from '@_all_docs/cache';

const env = {
  RUNTIME: 'node',
  CACHE_DIR: './cache/partitions'
};

const driver = await createStorageDriver(env);
const frame = await PartitionFrame.fromCache('./cache/partitions', driver);

// Find all packages depending on 'express'
const expressDependents = [];
await frame.reduceAsync((acc, entry) => {
  const packument = entry.value;
  if (packument.dependencies?.express ||
      packument.devDependencies?.express) {
    expressDependents.push(packument.name);
  }
  return acc;
}, []);

console.log(`Found ${expressDependents.length} packages depending on express`);
```

### Monitoring Registry Changes

```bash
# Create a baseline index
npx _all_docs cache create-index > baseline.txt

# Later, refresh and compare
npx _all_docs partition refresh --pivots ./pivots.js
npx _all_docs cache create-index > current.txt

# Find new packages
diff baseline.txt current.txt | grep "^>" | cut -d' ' -f2
```

## Configuration

### Environment Variables

```bash
# Set the npm registry origin (default: https://replicate.npmjs.com)
export NPM_ORIGIN=https://replicate.npmjs.com

# Set the npm registry for packuments (default: https://registry.npmjs.org)
export NPM_REGISTRY=https://registry.npmjs.org

# Set cache directory (default: ./cache)
export CACHE_DIR=/path/to/cache

# Enable debug output
export DEBUG=_all_docs*
```

### Cache Location

By default, the cache is stored in:
- Partitions: `./cache/partitions/`
- Packuments: `./cache/packuments/`

You can change this with the `--cache-dir` flag or `CACHE_DIR` environment variable.

## Performance Tips

### 1. Optimize Pivot Selection

More pivots create smaller partitions, which:
- ✅ Reduces memory usage per operation
- ✅ Enables better parallelization
- ❌ Increases the total number of HTTP requests

### 2. Use Rate Limiting

The npm registry has rate limits. Respect them:

```javascript
// When using the API programmatically
import { PartitionClient } from '@_all_docs/partition/client';

const client = new PartitionClient({
  env: { RUNTIME: 'node' },
  rateLimiter: {
    requestsPerSecond: 10  // Be conservative
  }
});
```

### 3. Enable Request Coalescing

Prevent duplicate concurrent requests:

```javascript
import { Cache } from '@_all_docs/cache';

const cache = new Cache({
  coalesceRequests: true,  // Deduplicates concurrent fetches
  driver: await createStorageDriver(env)
});
```

### 4. Monitor Cache Size

The cache can grow large. Monitor and manage it:

```bash
# Check cache size
du -sh cache/

# Remove old cache entries (implement your own policy)
find cache/ -type f -mtime +30 -delete
```

## Troubleshooting

### "429 Too Many Requests" Errors

You're hitting rate limits. Solutions:
- Reduce concurrency in your requests
- Add delays between operations
- Use the `--rate-limit` flag with CLI commands

### "ENOENT: no such file or directory" Errors

The cache directory doesn't exist or has incorrect permissions:

```bash
mkdir -p cache/partitions cache/packuments
chmod 755 cache/
```

### Large Memory Usage

Processing large partitions can use significant memory:
- Use more granular pivots to create smaller partitions
- Process partitions sequentially instead of in parallel
- Increase Node.js memory limit: `NODE_OPTIONS="--max-old-space-size=4096"`

### Incomplete Cache Data

If operations were interrupted:

```bash
# Validate and identify incomplete partitions
npx _all_docs cache validate-partitions

# Re-fetch specific partitions
npx _all_docs partition fetch --start-key "prob" --end-key "proc"
```

## Next Steps

- Read the [Architecture Guide](./architecture.md) to understand the system design
- Check the [CLI Reference](./cli-reference.md) for all available commands
- Review the [API Documentation](./api.md) for programmatic usage

## Getting Help

- 📚 [Full Documentation](https://github.com/indexzero/_all_docs/tree/main/doc)
- 🐛 [Report Issues](https://github.com/indexzero/_all_docs/issues)

## Quick Reference Card

```bash
# Essential Commands
npx _all_docs partition refresh --pivots ./pivots.js  # Fetch all partitions
npx _all_docs packument fetch <package-name>          # Fetch single package
npx _all_docs cache create-index                      # List cached data
npx _all_docs cache validate-partitions               # Check cache integrity

# Useful Flags
--cache-dir <path>     # Set cache location
--rate-limit <n>       # Limit requests per second
--concurrency <n>      # Parallel operations
--debug               # Verbose output
--help               # Get help for any command
```
