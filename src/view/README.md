# @_all_docs/view

Views provide a way to query and join cached registry data using origin expressions.

## What is a View?

A **view** is:
1. A **predicate** (origin filter) that selects which cache entries to scan
2. A **projection** (field selection) that transforms each record

Views are stored as JSON files and can be queried or joined with other views.

## Why Views?

The `_all_docs` cache stores packuments keyed by `v1:{type}:{origin}:{hex-name}`. When you want to find packages that exist in npm but not in your private registry, you need to:

1. Scan all npm entries
2. For each, check if the private registry has it
3. Output the difference

Without views, this requires knowing the internal cache key structure. Views abstract this away:

```bash
# Define what "npm packages" means
_all_docs view define npm-pkgs --origin npm --select 'name, versions|keys'

# Define what "private packages" means
_all_docs view define private-pkgs --origin my-registry.example.com --select 'name, versions|keys'

# Find packages in npm that aren't in private
_all_docs view join npm-pkgs private-pkgs --diff
```

## View Definition

A view has these properties:

| Property | Description |
|----------|-------------|
| `name` | Unique identifier for the view |
| `origin` | Encoded origin key (e.g., `npm`, `paces.exale.com~javpt`) |
| `registry` | Original registry URL (optional, for display) |
| `type` | Entity type: `packument` (default) or `partition` |
| `select` | Field projection expression |

## Select Expression Syntax

The select expression defines which fields to include and how to transform them.

### Simple Fields
```
name, description, license
```

### Nested Fields
```
time.modified, repository.url
```

### Transforms
```
versions|keys                    # Get object keys as array
versions|keys|length             # Count of versions
dependencies|keys|sort           # Sorted dependency names
```

### Aliases
```
versions|keys as version_list    # Rename the output field
time.modified as modified        # Simplify nested field name
```

### Available Transforms

| Transform | Description |
|-----------|-------------|
| `keys` | Object keys as array |
| `values` | Object values as array |
| `length` | Array or string length |
| `first` | First element |
| `last` | Last element |
| `sort` | Sort array |
| `reverse` | Reverse array |
| `unique` | Deduplicate array |
| `compact` | Remove null/undefined |
| `flatten` | Flatten nested arrays |
| `entries` | Object entries as [key, value] pairs |
| `sum` | Sum numeric array |
| `min` | Minimum value |
| `max` | Maximum value |

## CLI Commands

### Define a View
```bash
_all_docs view define <name> --origin <key> [--select <expr>]
_all_docs view define <name> --registry <url> [--select <expr>]

# Examples
_all_docs view define npm-pkgs --origin npm
_all_docs view define npm-vers --origin npm --select 'name, versions|keys as versions'
_all_docs view define private --registry https://npm.company.com
```

### List Views
```bash
_all_docs view list
_all_docs view list --json
```

### Show View Details
```bash
_all_docs view show npm-vers
_all_docs view show npm-vers --json
```

### Query a View
```bash
_all_docs view query <name> [options]

# Examples
_all_docs view query npm-vers                    # Stream all as ndjson
_all_docs view query npm-vers --limit 100        # First 100 records
_all_docs view query npm-vers --count            # Just the count
_all_docs view query npm-vers --filter "name=lodash"
_all_docs view query npm-vers --collect > all.json
```

### Join Two Views
```bash
_all_docs view join <left> <right> [options]

# Join types
--left      # All from left, matching from right (default)
--inner     # Only records in both
--right     # All from right, matching from left
--full      # All records from both
--diff      # Records in left but not in right
```

**Example: Find suspicious packages with install scripts but no node-gyp dependency**

Packages with `preinstall` or `postinstall` scripts typically need them for native compilation (node-gyp). Packages with these scripts that *don't* depend on node-gyp may warrant investigation.

```bash
# View 1: Packages with install scripts
_all_docs view define has-install-scripts --origin npm \
  --select 'name, scripts.preinstall, scripts.postinstall' \
  --where 'scripts.preinstall != null || scripts.postinstall != null'

# View 2: Packages that depend on node-gyp
_all_docs view define uses-node-gyp --origin npm \
  --select 'name' \
  --where 'dependencies["node-gyp"] != null || devDependencies["node-gyp"] != null'

# Find packages with install scripts but NO node-gyp dependency
_all_docs view join has-install-scripts uses-node-gyp --diff | head -100
```

### Delete a View
```bash
_all_docs view delete <name>
```

## Programmatic API

```javascript
import { View, ViewStore, queryView, joinViews, diffViews } from '@_all_docs/view';
import { Cache } from '@_all_docs/cache';

// Create and save a view
const view = new View({
  name: 'npm-packages',
  origin: 'npm',
  select: 'name, versions|keys as versions'
});

const store = new ViewStore('/path/to/config');
await store.save(view);

// Query a view
const cache = new Cache({ cacheDir: '/path/to/cache' });

for await (const record of queryView(view, cache)) {
  console.log(record);  // { name: 'lodash', versions: ['1.0.0', '2.0.0', ...] }
}

// Join two views
const npmView = await store.load('npm-packages');
const privateView = await store.load('private-packages');

for await (const result of joinViews(npmView, privateView, cache, { type: 'inner' })) {
  console.log(result);  // { name: '...', left: {...}, right: {...} }
}

// Find packages in npm not in private
for await (const result of diffViews(npmView, privateView, cache)) {
  console.log(result.left.name);  // Package only in npm
}
```

## How Joins Work

Joins use **O(1) lookups** for the right side by constructing cache keys directly:

1. Stream all records from the left view's origin prefix
2. For each record, construct the right-side cache key using the join key
3. Fetch the right record directly (no scanning)
4. Output based on join type

This makes joins efficient even with millions of records.

## Storage

Views are stored in `{configDir}/views/{name}.view.json`:

```json
{
  "name": "npm-versions",
  "origin": "npm",
  "registry": null,
  "type": "packument",
  "select": "name, versions|keys as versions, time.modified",
  "createdAt": "2024-01-15T10:30:00.000Z"
}
```
