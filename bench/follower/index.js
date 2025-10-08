#!/usr/bin/env node

/**
 * NPM Registry Follower
 *
 * Efficient streaming follower for npm registry changes
 */

import { createWriteStream, existsSync, readFileSync, writeFileSync } from 'fs';

const REGISTRY = 'https://replicate.npmjs.com/registry/_changes';
const BATCH_SIZE = 10000;
const CHECKPOINT_FILE = 'checkpoint.json';

// Get starting sequence from args or checkpoint
let currentSeq = parseInt(process.argv[2] || '0');
let targetSeq = null;
let output = null;
let eventsProcessed = 0;
const startTime = Date.now();

// Resume from checkpoint if exists
if (existsSync(CHECKPOINT_FILE)) {
  try {
    const checkpoint = JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'));
    currentSeq = checkpoint.seq || currentSeq;
    console.log(`✨ Resuming from sequence ${currentSeq}`);
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
  const filename = `data/changes-${currentSeq}-${Date.now()}.jsonl`;
  output = createWriteStream(filename);
  console.log(`💾 Writing to: ${filename}\n`);

  while (currentSeq < targetSeq) {
    const url = `${REGISTRY}?since=${currentSeq}&limit=${BATCH_SIZE}`;

    try {
      console.log(`🔄 Fetching from ${currentSeq}...`);
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
        console.log('✅ No more changes!');
        break;
      }

      // Write changes to file
      for (const change of results) {
        output.write(JSON.stringify(change) + '\n');
        currentSeq = change.seq;
        eventsProcessed++;
      }

      // Save checkpoint
      writeFileSync(CHECKPOINT_FILE, JSON.stringify({
        seq: currentSeq,
        timestamp: new Date().toISOString()
      }));

      // Progress
      const progress = ((currentSeq - parseInt(process.argv[2] || '0')) / (targetSeq - parseInt(process.argv[2] || '0')) * 100).toFixed(1);
      const rate = (eventsProcessed / ((Date.now() - startTime) / 1000)).toFixed(0);
      console.log(`  ✓ Processed ${results.length} events (${progress}% - ${rate} events/sec)`);

      // Done?
      if (results.length < BATCH_SIZE) {
        console.log('\n🎉 Caught up to latest!');
        break;
      }

    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
      console.log('⏳ Retrying in 5s...');
      await sleep(5000);
    }
  }

  // Final stats
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n📈 Final Statistics:');
  console.log(`  • Events processed: ${eventsProcessed}`);
  console.log(`  • Final sequence: ${currentSeq}`);
  console.log(`  • Time taken: ${duration}s`);
  console.log(`  • Average rate: ${(eventsProcessed / duration).toFixed(0)} events/sec`);

  if (output) output.end();
  console.log('\n✅ Complete!');
}

// Utils
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Ctrl+C handler
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Stopping...');
  if (output) output.end();

  writeFileSync(CHECKPOINT_FILE, JSON.stringify({
    seq: currentSeq,
    timestamp: new Date().toISOString()
  }));

  console.log(`📍 Stopped at sequence: ${currentSeq}`);
  console.log(`💾 Checkpoint saved. Run again to resume.`);
  process.exit(0);
});

// Start
run().catch(err => {
  console.error('💥 Fatal error:', err);
  process.exit(1);
});