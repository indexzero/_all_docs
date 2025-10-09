#!/usr/bin/env node

/**
 * NPM Registry Follower
 *
 * Efficient streaming follower for npm registry changes
 */

import {
  createWriteStream,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync
} from 'fs';

const REGISTRY = 'https://replicate.npmjs.com/registry/_changes';
const BATCH_SIZE = 10000;
const CHECKPOINT_FILE = 'checkpoint.json';

// Get starting sequence from args or checkpoint
const start = parseInt(process.argv[2] || '0');
let currentSeq = start;
let targetSeq = null;
let highestSeqEverSeen = 0;

let output = null;

// let eventsProcessed = 0;
// const startTime = Date.now();
let stats = {
  events: 0,
  sequenceResets: 0,
  startTime: Date.now()
};

// Resume from checkpoint if exists
if (existsSync(CHECKPOINT_FILE)) {
  try {
    const checkpoint = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
    currentSeq = checkpoint.seq || currentSeq;
    console.log(`✨ Resuming from checkpoint: %j`, checkpoint);
    highestSeqEverSeen = checkpoint.highestSeqEverSeen || checkpoint.seq;
  } catch (e) {
    console.log('⚠️  Bad checkpoint file, starting fresh');
  }
}

// Get target sequence
async function getTarget() {
  console.log('🎯 Getting target sequence...');
  const res = await fetch('https://replicate.npmjs.com/', {
    headers: { 'npm-replication-opt-in': 'true' }
  });

  if (!res.ok) throw new Error(`Failed to get target: ${res.status}`);
  const data = await res.json();
  return data.update_seq || data.committed_update_seq;
}

// Main loop
async function run() {

  targetSeq = await getTarget();
  console.log(`📦 NPM Registry Follower`);
  console.log(`📍 Start: ${currentSeq}`);
  console.log(`🎯 Target: ${targetSeq}`);
  console.log(`📊 Events to process: ${targetSeq - currentSeq}\n`);

  // Open output file
  // Create output directory and file
  const dataDir = 'data';
  mkdirSync(dataDir, { recursive: true });
  const filename = `${dataDir}/changes-${currentSeq}-${Date.now()}.jsonl`;
  output = createWriteStream(filename);
  console.log(`💾 Writing to: ${filename}`);

  while (true) {
    const url = `${REGISTRY}?since=${currentSeq}&limit=${BATCH_SIZE}`;

    try {
      console.log(`\n🔄 Fetching from ${currentSeq}...`);
      console.log(`├── GET ${url}`);

      const res = await fetch(url, {
        headers: { 'npm-replication-opt-in': 'true' }
      });

      if (!res.ok) {
        console.error(`❌ HTTP ${res.status} - waiting 5s...`);
        await sleep(5000);
        continue;
      }

      const data = await res.json();
      const results = data.results || [];

      if (results.length === 0) {
        console.log('└── ⏸️  No changes, waiting 10s...');
        await sleep(10000);
        continue;
      }

      // Write changes to file
      let latestSeq = 0;
      for (const change of results) {
        output.write(JSON.stringify(change) + '\n');
        latestSeq = Math.max(latestSeq, change.seq);
        stats.events++;
      }

      // Detect sequence resets/jumps
      if (highestSeqEverSeen > 0) {
        if (latestSeq < highestSeqEverSeen - 1000000) {
          stats.sequenceResets++;
          console.warn(`├── 🔄 Sequence reset detected: ${highestSeqEverSeen} → ${latestSeq}`);

          // Verify with registry root
          const verifyRes = await fetch(`${REGISTRY}/`, {
            headers: { 'npm-replication-opt-in': 'true' }
          });

          const verify = await verifyRes.json();
          if (verify.update_seq === latestSeq) {
            console.log(`├── ✓ Reset confirmed by registry`);
            checkpoint.seq = verify.update_seq;
          }
        } else if (latestSeq > highestSeqEverSeen + 1000000) {
          console.warn(`├── 🚀 Massive sequence jump: ${highestSeqEverSeen} → ${latestSeq}`);
        }
      }
      highestSeqEverSeen = Math.max(highestSeqEverSeen, latestSeq);

      // Update currentSeq & save checkpoint
      currentSeq = latestSeq;
      console.log(`├── [${res.headers.get('date')}] Updated current sequence to { currentSeq: ${currentSeq}, highestSeqEverSeen: ${highestSeqEverSeen} }`);
      writeFileSync(CHECKPOINT_FILE, JSON.stringify({
        seq: currentSeq,
        highestSeqEverSeen,
        timestamp: new Date().toISOString()
      }));

      // Progress
      const progress = ((currentSeq - start) / (targetSeq - start) * 100).toFixed(1);
      const rate = (stats.events / ((Date.now() - stats.startTime) / 1000)).toFixed(0);
      console.log(`└── ✓ Processed ${results.length} events (${progress}% - ${rate} events/sec)`);

      // Done?
      if (results.length < BATCH_SIZE) {
        console.log('\n🎉 Caught up to latest! Waiting 60s before fetching new target');
        await sleep(60000);
        targetSeq = await getTarget();
        console.log(`🎯 New target: ${targetSeq}`);
      }

    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      console.log('⏳ Retrying in 5s...');
      await sleep(5000);
    }
  }

  // Final stats
  const duration = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  console.log('\n📈 Final Statistics:');
  console.log(`  • Events processed: ${stats.events}`);
  console.log(`  • Sequence resets: ${stats.sequenceResets}`);
  console.log(`  • Final sequence: ${currentSeq}`);
  console.log(`  • Time taken: ${duration}s`);
  console.log(`  • Average rate: ${(stats.events / duration).toFixed(0)} events/sec`);

  if (output) output.end();
  console.log('\n✅ Complete!');
}

// Utils
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Ctrl+C handler
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Shutting down gracefully...');
  if (output) output.end();

  writeFileSync(CHECKPOINT_FILE, JSON.stringify({
    seq: currentSeq,
    highestSeqEverSeen,
    timestamp: new Date().toISOString()
  }));

  console.log(`📍 Stopped at sequence: ${currentSeq}`);
  console.log(`💾 Checkpoint saved. Run again to resume.`);
  process.exit(0);
});

// Handle uncaught errors
process.on('unhandledRejection', (err) => {
  console.error('💥 Unhandled rejection:', err);
  throw err; // Crash for now
});


// Start
run().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});
