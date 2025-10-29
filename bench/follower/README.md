# NPM Registry Follower

A high-performance, minimal NPM registry changes follower designed for benchmarking replication throughput.

## Features

- **Zero dependencies** - Pure Node.js implementation using native fetch
- **Beautiful tree-style logging** - Clear visual hierarchy for monitoring
- **Resumable** - Checkpoint-based resume capability for handling interruptions
- **Fast** - Processes 1000-2000 events/second
- **Sequence reset detection** - Handles infrastructure changes gracefully
- **Efficient** - ~20MB memory footprint
- **Simple** - ~200 lines of readable code

## Installation

```bash
# Clone the repository
git clone <repo-url>
cd bench/follower

# No npm install needed - zero dependencies!
```

## Usage

### Start from beginning
```bash
node index.js 0
```

### Start from specific sequence
```bash
node index.js 81600000
```

### Resume from checkpoint
```bash
node index.js
```

## Output

The follower saves changes to timestamped JSONL files in the `data/` directory:
```
data/changes-81600000-1759909994532.jsonl
```

Each line is a JSON object representing a change event:

```json
{"seq":81608001,"id":"@grafana/create-plugin","changes":[{"rev":"2-abc"}],"deleted":false}
```

## Architecture

The follower uses a simple forward-polling approach with the npm registry's `_changes` endpoint:

1. Fetches the target sequence from the registry
2. Requests changes in batches of 10,000 events using `since` parameter
3. Streams results directly to JSONL files
4. Saves checkpoint after each batch
5. Detects and handles sequence resets/jumps
6. Continues until caught up, then polls periodically for new changes

## Monitoring Output

### Standard Operation
Beautiful tree-style logging during normal operation:
```
🔄 Fetching from 81161171...
├── GET https://replicate.npmjs.com/registry/_changes?since=81161171&limit=10000
├── [Thu, 09 Oct 2025 12:34:56 GMT] Updated current sequence to { currentSeq: 81313556, highestSeqEverSeen: 81313556 }
└── ✓ Processed 10000 events (99.5% - 11838 events/sec)

🔄 Fetching from 81313556...
├── GET https://replicate.npmjs.com/registry/_changes?since=81313556&limit=10000
├── [Thu, 09 Oct 2025 12:34:57 GMT] Updated current sequence to { currentSeq: 81466275, highestSeqEverSeen: 81466275 }
└── ✓ Processed 10000 events (99.7% - 11820 events/sec)
```

### Sequence Reset Detection
When sequences jump backward (happened during npm migration):
```
🔄 Fetching from 61000000...
├── GET https://replicate.npmjs.com/registry/_changes?since=61000000&limit=10000
├── 🔄 Sequence reset detected: 61000000 → 41000000
├── ✓ Reset confirmed by registry
├── [Thu, 09 Oct 2025 12:35:00 GMT] Updated current sequence to { currentSeq: 41000000, highestSeqEverSeen: 61000000 }
└── ✓ Processed 10000 events (65.2% - 9823 events/sec)
```

### Caught Up State
When the follower reaches the latest sequence:
```
🔄 Fetching from 81718148...
├── GET https://replicate.npmjs.com/registry/_changes?since=81718148&limit=10000
├── [Thu, 09 Oct 2025 12:35:02 GMT] Updated current sequence to { currentSeq: 81721320, highestSeqEverSeen: 81721320 }
└── ✓ Processed 1019 events (100.0% - 11777 events/sec)

🎉 Caught up to latest! Waiting 60s before fetching new target
🎯 New target: 81721450
```

### Idle State
When no new changes are available:
```
🔄 Fetching from 81721450...
├── GET https://replicate.npmjs.com/registry/_changes?since=81721450&limit=10000
└── ⏸️  No changes, waiting 10s...
```

## Checkpoint System

Progress is automatically saved to `checkpoint.json` after each batch:
```json
{
  "seq": 81611545,
  "highestSeqEverSeen": 81611545,
  "timestamp": "2025-10-09T12:34:56.789Z"
}
```

The `highestSeqEverSeen` field helps detect sequence resets during infrastructure changes.

## Configuration

Edit these constants in `index.js`:

```javascript
const REGISTRY = 'https://replicate.npmjs.com/registry/_changes';
const BATCH_SIZE = 10000;  // Events per fetch
const CHECKPOINT_FILE = 'checkpoint.json';
```

## Performance

Typical performance metrics:
- **Throughput**: 10,000-12,000 events/second during catch-up
- **Memory**: ~20MB
- **Network**: Efficient batch fetching (10k events per request)
- **Disk I/O**: Direct streaming to files
- **Latency**: ~1-2 seconds per 10,000 events

## Error Handling

- Automatic retry with 5-second backoff on HTTP errors
- Checkpoint persistence for resume capability
- Sequence reset detection and verification
- Graceful shutdown on Ctrl+C with checkpoint save

## Final Statistics

Graceful shutdown (Ctrl+C) shows complete statistics:
```
⏹️  Shutting down gracefully...
📍 Stopped at sequence: 81721320
💾 Checkpoint saved. Run again to resume.
```

## Requirements

- Node.js 18+ (for native fetch support)
- Necessary disk space for full registry (81M+ events)
- Stable internet connection

## Benchmarking

To benchmark full registry replication:

```bash
# Remove old checkpoint
rm -f checkpoint.json

# Start timer and run
time node index.js 0

# Monitor progress
tail -f data/changes-*.jsonl | wc -l
```

Estimated time for full replication:
- ~81.7M events at 10,000 events/sec = ~2.3 hours

## Data Analysis Scripts

Once you've collected change data, use these scripts to analyze the npm registry:

### Extract All Package Names

The `names.js` script processes all JSONL files and creates a lexographically sorted list of all package names:

```bash
node names.js
```

which produces these files:

- `data/names/raw.txt` - All package names extracted from changes, with duplicates
- `data/names/all.json` - Deduplicated, lexographically sorted JSON array

```
┌── Extracting npm package names
├── Extracting package names from JSONL files
│   ├── Found 5 JSONL files
│   ├── Processed changes-0-1759987475324.jsonl: 5,680,001 names
│   └── Extracted 5,806,331 total names to raw.txt
├── Deduplicating and sorting names
│   ├── Found 5,705,687 unique names
│   ├── Removed 100,644 duplicates
│   └── Wrote 5,705,687 names to all.json
│
└── Complete in 13.00s (1.7% deduplication)
```

### Analyze Scopes

The `scopes.js` script analyzes package names and counts packages by scope:

```bash
node scopes.js
```

which produces:

- `data/names/scopes.json` (10MB) - Array of tuples `[["scope", count], ...]` sorted by count

**Format:**
```json
[
  ["UNSCOPED",4365452],
  ["infinitebrahmanuniverse",33405],
  ["hyper.fun",30273],
  ["zalastax",25780],
  ["types",11299]
]
```

**Example output:**
```
┌── Analyzing package scopes
├── Reading names/all.json
│   └── Loaded 5,705,687 package names
├── Counting packages by scope
│   ├── Found 323,557 unique scopes
│   ├── Unscoped: 4,365,452 packages
│   └── Scoped: 1,340,235 packages
│
└── Complete in 0.99s (23.5% scoped packages)

Top 10 scopes by package count:
  UNSCOPED                        4,365,452 ████████████...
  infinitebrahmanuniverse            33,405 ███
  hyper.fun                          30,273 ███
```

## Technical Details

This implementation follows npm's 2025 replication API requirements:
- Uses `/registry/_changes` endpoint (not `/_changes`)
- Includes required `npm-replication-opt-in: true` header
- Implements paginated polling with `since` parameter
- Handles sequence resets and jumps gracefully
- Efficient batch processing (10k events per request)

## Why This Design?

This follower prioritizes:
1. **Simplicity** - Forward-only polling is easy to understand
2. **Speed** - Batch processing maximizes throughput
3. **Reliability** - Checkpoints ensure no data loss
4. **Monitoring** - Beautiful tree-style logs show exactly what's happening
5. **Production readiness** - Handles real infrastructure issues (resets, jumps)

## License

MIT
