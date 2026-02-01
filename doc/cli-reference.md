# CLI Reference

Complete reference for all `@_all_docs/cli` commands.

## Global Options

These options are available for all commands:

```bash
--cache-dir <path>      # Set cache directory (default: ./cache)
--debug                 # Enable debug output
--help                  # Show help for command
--version              # Show version information
```

## Commands Overview

```bash
npx _all_docs <command> [subcommand] [options]
```

Available commands:
- `partition` - Work with registry partitions
- `packument` - Fetch and manage package documents
- `cache` - Manage local cache

---

## partition

Commands for working with npm registry partitions.

### partition refresh

Refresh all partitions based on provided pivots.

```bash
npx _all_docs partition refresh --pivots <path>
```

**Options:**
- `--pivots <path>` (required) - Path to JavaScript file exporting pivot array
- `--concurrency <n>` - Number of concurrent requests (default: 10)
- `--rate-limit <n>` - Max requests per second (default: 20)
- `--force` - Force refresh even if cache is valid
- `--origin <url>` - npm registry origin (default: https://replicate.npmjs.com)

**Example:**

```javascript
// pivots.js
module.exports = ['a', 'b', 'c', 'd', 'e', 'f'];
```

```bash
npx _all_docs partition refresh --pivots ./pivots.js --concurrency 5
```

**Output:**
- Creates cache files in `cache/partitions/v1:partition:npm:{hex}:{hex}.json`
- Displays progress and statistics during fetch

### partition fetch

Fetch a single partition by start and end keys.

```bash
npx _all_docs partition fetch --start-key <key> --end-key <key>
```

**Options:**
- `--start-key <key>` - Starting key for partition range
- `--end-key <key>` - Ending key for partition range
- `--origin <url>` - npm registry origin (default: https://replicate.npmjs.com)
- `--force` - Force fetch even if cached

**Example:**

```bash
# Fetch packages from 'express' to 'express-z'
npx _all_docs partition fetch --start-key express --end-key express-z

# Fetch packages starting with 'a'
npx _all_docs partition fetch --start-key a --end-key b
```

**Output:**
- Cache file: `cache/partitions/v1:partition:npm:{hex(start)}:{hex(end)}.json`
- Console: Row count and cache status

### partition list

List all cached partitions.

```bash
npx _all_docs partition list
```

**Options:**
- `--format <format>` - Output format: json, table, csv (default: table)
- `--sort <field>` - Sort by: key, size, date (default: key)

**Example:**

```bash
npx _all_docs partition list --format json | jq '.[] | .key'
```

**Output:**
```
┌─────────┬──────────┬──────────┬────────┬──────────────┐
│ Start   │ End      │ Rows     │ Size   │ Cached       │
├─────────┼──────────┼──────────┼────────┼──────────────┤
│ (null)  │ a        │ 45,231   │ 2.1MB  │ 2024-01-15   │
│ a       │ b        │ 38,492   │ 1.8MB  │ 2024-01-15   │
└─────────┴──────────┴──────────┴────────┴──────────────┘
```

---

## packument

Commands for fetching and managing package documents.

### packument fetch

Fetch a single package document.

```bash
npx _all_docs packument fetch <package-name>
```

**Arguments:**
- `<package-name>` - Name of the package to fetch

**Options:**
- `--registry <url>` - npm registry URL (default: https://registry.npmjs.org)
- `--full` - Fetch full packument including README
- `--force` - Force fetch even if cached

**Example:**

```bash
# Fetch express packument
npx _all_docs packument fetch express

# Fetch with full metadata
npx _all_docs packument fetch express --full

# Fetch scoped package
npx _all_docs packument fetch @babel/core
```

**Output:**
- Cache file: `cache/packuments/v1:packument:npm:{hex(name)}.json`
- Console: Package name, version count, cache status

### packument show

Display a cached packument with optional field selection.

```bash
npx _all_docs packument show <name[@version]> [options]
```

**Arguments:**
- `<name[@version]>` - Package name, optionally with version

**Options:**
- `--select <expr>` - Project specific fields using selector syntax
- `--registry <url>` - Registry URL (default: npm)
- `--raw` - Output raw JSON without formatting

**Selector Syntax:**
- `field` - Simple field access
- `field.nested` - Nested field access
- `field["key"]` - Bracket notation (for keys with special chars)
- `field|transform` - Apply transform (keys, values, length, etc.)
- `expr as alias` - Rename output field

**Examples:**

```bash
# Show full packument
npx _all_docs packument show lodash

# Get version list
npx _all_docs packument show lodash --select 'versions|keys'

# Get publish date for specific version
npx _all_docs packument show lodash --select 'time["4.17.21"]'

# Get integrity hash for versioned packument
npx _all_docs packument show lodash@4.17.21 --select 'dist.integrity'

# Get multiple fields
npx _all_docs packument show lodash --select 'name, versions|keys|length as count'
```

**Use Cases:**

```bash
# Build verification - check integrity hash
npx _all_docs packument show express@4.18.2 --select 'dist.integrity'

# Audit - check publish date
npx _all_docs packument show left-pad --select 'time["1.1.1"]'

# Quick version count
npx _all_docs packument show lodash --select 'versions|keys|length'

# Get tarball URL for download
npx _all_docs packument show react@18.2.0 --select 'dist.tarball'
```

### packument fetch-list

Fetch multiple packuments from a list.

```bash
npx _all_docs packument fetch-list <list-file>
```

**Arguments:**
- `<list-file>` - Path to JSON array of package names

**Options:**
- `--registry <url>` - npm registry URL (default: https://registry.npmjs.org)
- `--concurrency <n>` - Concurrent fetches (default: 10)
- `--rate-limit <n>` - Max requests per second (default: 20)
- `--continue-on-error` - Continue if individual fetches fail

**Example:**

```bash
# Create package list
echo '["express", "react", "vue", "angular"]' > packages.json

# Fetch all packages
npx _all_docs packument fetch-list ./packages.json

# With rate limiting
npx _all_docs packument fetch-list ./packages.json --rate-limit 5
```

**Output:**
- Progress bar showing fetch status
- Summary: X succeeded, Y failed, Z cached

### packument export

Export packuments to a directory.

```bash
npx _all_docs packument export <list-file> <output-dir>
```

**Arguments:**
- `<list-file>` - JSON array of package names to export
- `<output-dir>` - Directory to export packuments to

**Options:**
- `--format <format>` - Output format: json, ndjson (default: json)
- `--include-deps` - Include dependencies in export

**Example:**

```bash
# Export specific packages
echo '["express", "body-parser"]' > export-list.json
npx _all_docs packument export ./export-list.json ./exported

# Export with dependencies
npx _all_docs packument export ./export-list.json ./exported --include-deps
```

**Output:**
- Files: `<output-dir>/<package-name>.json` for each package
- Console: Export statistics

---

## cache

Commands for managing the local cache.

### cache create-index

Create an index of all cached items.

```bash
npx _all_docs cache create-index
```

**Options:**
- `--type <type>` - Index type: partition, packument, all (default: partition)
- `--format <format>` - Output format: text, json, csv (default: text)
- `--output <file>` - Write to file instead of stdout

**Example:**

```bash
# Create partition index
npx _all_docs cache create-index > partition-index.txt

# Create JSON index of packuments
npx _all_docs cache create-index --type packument --format json

# Save to file
npx _all_docs cache create-index --output index.txt
```

**Output (text format):**
```
["https://replicate.npmjs.com/_all_docs?startkey=%22a%22&endkey=%22aa%22","a","aa"]
["https://replicate.npmjs.com/_all_docs?startkey=%22aa%22&endkey=%22ab%22","aa","ab"]
```

### cache validate-partitions

Validate integrity of cached partitions.

```bash
npx _all_docs cache validate-partitions
```

**Options:**
- `--fix` - Attempt to fix corrupted entries
- `--remove-invalid` - Remove invalid cache entries
- `--concurrency <n>` - Validation concurrency (default: 10)

**Example:**

```bash
# Basic validation
npx _all_docs cache validate-partitions

# Fix issues
npx _all_docs cache validate-partitions --fix

# Remove corrupted entries
npx _all_docs cache validate-partitions --remove-invalid
```

**Output:**
```
Validating 156 partitions...
✓ 154 valid
✗ 2 invalid
  - v1:partition:npm:6161:6162 (corrupted JSON)
  - v1:partition:npm:7878:7879 (missing data)
```

### cache export

Export cached data to a directory.

```bash
npx _all_docs cache export <list-file> <output-dir>
```

**Arguments:**
- `<list-file>` - JSON array of items to export
- `<output-dir>` - Target directory for export

**Options:**
- `--type <type>` - Cache type: partition, packument (default: packument)
- `--format <format>` - Output format: json, ndjson (default: json)

**Example:**

```bash
# Export packuments
echo '["express", "react"]' > export.json
npx _all_docs cache export ./export.json ./backup

# Export partitions
npx _all_docs cache export ./partition-list.json ./backup --type partition
```

### cache stats

Display cache statistics.

```bash
npx _all_docs cache stats
```

**Options:**
- `--detailed` - Show detailed breakdown
- `--format <format>` - Output format: table, json (default: table)

**Example:**

```bash
npx _all_docs cache stats --detailed
```

**Output:**
```
Cache Statistics
═══════════════════════════════════
Partitions:
  Count:      156
  Total Size: 245.3 MB
  Oldest:     2024-01-01
  Newest:     2024-01-15

Packuments:
  Count:      3,847
  Total Size: 892.1 MB
  Oldest:     2024-01-05
  Newest:     2024-01-15

Total Cache Size: 1.14 GB
```

### cache clear

Clear cache entries with flexible filtering options.

```bash
npx _all_docs cache clear [options]
```

**Options:**
- `--packuments` - Clear packument cache only
- `--partitions` - Clear partition cache only
- `--checkpoints` - Clear checkpoint files only
- `--registry <url>` - Clear entries for specific registry origin
- `--match-origin <key>` - Clear entries matching origin key (e.g., `custom.reg.io`)
- `--package <name>` - Clear cache for specific package
- `--older-than <duration>` - Clear entries older than duration (e.g., `7d`, `24h`, `30m`, `60s`)
- `--dry-run` - Show what would be cleared without deleting
- `--interactive`, `-i` - Prompt for confirmation before clearing

**Duration format:**
- `d` - days (e.g., `7d` = 7 days)
- `h` - hours (e.g., `24h` = 24 hours)
- `m` - minutes (e.g., `30m` = 30 minutes)
- `s` - seconds (e.g., `60s` = 60 seconds)

**Examples:**

```bash
# Clear everything (all cache types)
npx _all_docs cache clear

# Clear only packuments
npx _all_docs cache clear --packuments

# Clear only partitions
npx _all_docs cache clear --partitions

# Clear only checkpoint files
npx _all_docs cache clear --checkpoints

# Clear cache for a specific package
npx _all_docs cache clear --package lodash

# Clear cache for a specific registry
npx _all_docs cache clear --registry https://registry.npmjs.com

# Clear entries older than 7 days
npx _all_docs cache clear --older-than 7d

# Clear old packuments only
npx _all_docs cache clear --packuments --older-than 7d

# Preview what would be cleared (dry run)
npx _all_docs cache clear --dry-run

# Interactive mode - confirm before clearing
npx _all_docs cache clear --interactive
```

---

## Advanced Usage

### Using Debug Output

Enable detailed debugging information:

```bash
DEBUG=_all_docs* npx _all_docs partition refresh --pivots ./pivots.js
```

Debug namespaces:
- `_all_docs:cli` - CLI operations
- `_all_docs:partition` - Partition operations
- `_all_docs:packument` - Packument operations
- `_all_docs:cache` - Cache operations
- `_all_docs:http` - HTTP requests

### Programmatic CLI Usage

```javascript
import { CLI } from '@_all_docs/cli';

const cli = new CLI({
  cacheDir: '/custom/cache/dir',
  debug: true
});

// Run commands programmatically
await cli.run(['partition', 'refresh', '--pivots', './pivots.js']);
```

### Environment Variables

```bash
# Set cache directory
export CACHE_DIR=/path/to/cache

# Set npm registry endpoints
export NPM_ORIGIN=https://replicate.npmjs.com
export NPM_REGISTRY=https://registry.npmjs.org

# Enable debug output
export DEBUG=_all_docs*

# Set runtime (for worker mode)
export RUNTIME=node
```

### Configuration File

Create `.all_docsrc` in your project root:

```json
{
  "cacheDir": "./cache",
  "npmOrigin": "https://replicate.npmjs.com",
  "npmRegistry": "https://registry.npmjs.org",
  "concurrency": 10,
  "rateLimit": 20,
  "debug": false
}
```

---

## Exit Codes

- `0` - Success
- `1` - General error
- `2` - Invalid arguments
- `3` - Network error
- `4` - Cache error
- `5` - Rate limit exceeded
- `127` - Command not found

---

## Examples

### Complete Mirror Setup

```bash
#!/bin/bash
# mirror-setup.sh

# 1. Create comprehensive pivots
cat > pivots.js << 'EOF'
module.exports = [
  null,
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j',
  'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't',
  'u', 'v', 'w', 'x', 'y', 'z'
];
EOF

# 2. Fetch all partitions
npx _all_docs partition refresh --pivots ./pivots.js

# 3. Create index
npx _all_docs cache create-index --output partition-index.txt

# 4. Extract package names and fetch packuments
cat partition-index.txt | \
  jq -r '.rows[].id' | \
  jq -Rs 'split("\n")[:-1]' > all-packages.json

npx _all_docs packument fetch-list ./all-packages.json \
  --concurrency 5 \
  --rate-limit 10

# 5. Validate
npx _all_docs cache validate-partitions
npx _all_docs cache stats
```

### Incremental Updates

```bash
#!/bin/bash
# update.sh

# Refresh partitions (uses cache, only fetches changes)
npx _all_docs partition refresh --pivots ./pivots.js

# Find new packages
npx _all_docs cache create-index | \
  diff previous-index.txt - | \
  grep "^>" | \
  cut -d' ' -f2 > new-packages.txt

# Fetch new packuments
npx _all_docs packument fetch-list ./new-packages.txt

# Update index
npx _all_docs cache create-index > previous-index.txt
```

---

## Troubleshooting

### Common Issues

**Command not found:**
```bash
# Ensure global installation
npm install -g @_all_docs/cli

# Or use npx
npx @_all_docs/cli --help
```

**Rate limiting errors:**
```bash
# Reduce concurrency and rate
npx _all_docs partition refresh \
  --pivots ./pivots.js \
  --concurrency 2 \
  --rate-limit 5
```

**Memory issues with large operations:**
```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" \
  npx _all_docs packument fetch-list ./large-list.json
```

**Cache corruption:**
```bash
# Validate and fix
npx _all_docs cache validate-partitions --fix

# Or clear and restart (preview first with --dry-run)
npx _all_docs cache clear --dry-run
npx _all_docs cache clear
```