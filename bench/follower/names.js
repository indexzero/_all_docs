#!/usr/bin/env node

/**
 * names.js
 *
 * Extracts all npm package names from JSONL change files and creates
 * a lexographically sorted, deduplicated array.
 *
 * BELLA CIAO COMPLEXITY!
 *
 * Process:
 * 1. Stream all data/*.jsonl files
 * 2. Write package names to raw.txt AND deleted names to deleted.txt
 * 3. Merge: raw - deleted = active packages
 * 4. Sort into all.json
 */

import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInterface } from 'node:readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const NAMES_DIR = join(DATA_DIR, 'names');
const RAW_FILE = join(NAMES_DIR, 'raw.txt');
const DELETED_FILE = join(NAMES_DIR, 'deleted.txt');
const ALL_FILE = join(NAMES_DIR, 'all.json');

/**
 * Stream all JSONL files and extract package names to raw.txt and deleted.txt
 */
async function extractNames() {
  console.log('├── Extracting package names from JSONL files');

  // Ensure names directory exists
  await mkdir(NAMES_DIR, { recursive: true });

  // Get all JSONL files
  const files = (await readdir(DATA_DIR))
    .filter(f => f.endsWith('.jsonl'))
    .map(f => join(DATA_DIR, f));

  if (files.length === 0) {
    console.log('│   └── No JSONL files found in data/');
    return { total: 0, deleted: 0 };
  }

  console.log(`│   ├── Found ${files.length} JSONL files`);

  // TWO streams - one for active, one for deleted
  const rawStream = createWriteStream(RAW_FILE, { flags: 'w' });
  const deletedStream = createWriteStream(DELETED_FILE, { flags: 'w' });

  let totalNames = 0;
  let deletedCount = 0;

  for (const file of files) {
    let lineCount = 0;
    const rl = createInterface({
      input: createReadStream(file),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const change = JSON.parse(line);
        if (change.id) {
          if (change.deleted) {
            // Write to deleted.txt
            deletedStream.write(change.id + '\n');
            deletedCount++;
          } else {
            // Write to raw.txt
            rawStream.write(change.id + '\n');
            totalNames++;
          }
          lineCount++;
        }
      } catch (err) {
        // Skip malformed JSON lines
        continue;
      }
    }

    const filename = file.split('/').pop();
    console.log(`│   ├── Processed ${filename}: ${lineCount.toLocaleString()} changes`);
  }

  rawStream.end();
  deletedStream.end();

  await Promise.all([
    new Promise((resolve, reject) => {
      rawStream.on('finish', resolve);
      rawStream.on('error', reject);
    }),
    new Promise((resolve, reject) => {
      deletedStream.on('finish', resolve);
      deletedStream.on('error', reject);
    })
  ]);

  console.log(`│   ├── Wrote ${totalNames.toLocaleString()} names to raw.txt`);
  console.log(`│   └── Wrote ${deletedCount.toLocaleString()} deleted names to deleted.txt`);

  return { total: totalNames, deleted: deletedCount };
}

/**
 * Merge raw.txt and deleted.txt, then deduplicate and sort into all.json
 */
async function mergeAndSort() {
  console.log('├── Merging and deduplicating names');

  // Load all active package names
  console.log('│   ├── Loading raw.txt...');
  const rawNames = new Set();
  let rawRl = createInterface({
    input: createReadStream(RAW_FILE),
    crlfDelay: Infinity
  });

  for await (const line of rawRl) {
    const name = line.trim();
    if (name) rawNames.add(name);
  }

  console.log(`│   ├── Loaded ${rawNames.size.toLocaleString()} unique names from raw.txt`);

  // Load all deleted package names
  console.log('│   ├── Loading deleted.txt...');
  const deletedNames = new Set();
  let deletedRl = createInterface({
    input: createReadStream(DELETED_FILE),
    crlfDelay: Infinity
  });

  for await (const line of deletedRl) {
    const name = line.trim();
    if (name) deletedNames.add(name);
  }

  console.log(`│   ├── Loaded ${deletedNames.size.toLocaleString()} unique deleted names`);

  // Subtract: active = raw - deleted
  console.log('│   ├── Computing active packages (raw - deleted)...');
  for (const deleted of deletedNames) {
    rawNames.delete(deleted);
  }

  const activeCount = rawNames.size;
  const removedCount = deletedNames.size;
  console.log(`│   ├── Active packages: ${activeCount.toLocaleString()}`);
  console.log(`│   ├── Removed ${removedCount.toLocaleString()} deleted packages`);

  // Sort
  console.log('│   ├── Sorting lexographically...');
  const sorted = Array.from(rawNames).sort();

  // Write
  console.log('│   ├── Writing to all.json...');
  const output = createWriteStream(ALL_FILE);

  output.write('[\n');
  for (let i = 0; i < sorted.length; i++) {
    const name = sorted[i];
    const line = i === sorted.length - 1
      ? `  ${JSON.stringify(name)}\n`
      : `  ${JSON.stringify(name)},\n`;
    output.write(line);
  }
  output.write(']\n');
  output.end();

  await new Promise((resolve, reject) => {
    output.on('finish', resolve);
    output.on('error', reject);
  });

  console.log(`│   └── Wrote ${sorted.length.toLocaleString()} names to all.json`);
  return sorted.length;
}

/**
 * Main execution
 */
async function main() {
  const startTime = Date.now();

  console.log('\n┌── Extracting npm package names');

  try {
    const { total, deleted } = await extractNames();

    if (total === 0 && deleted === 0) {
      console.log('└── No names to process\n');
      return;
    }

    const activeNames = await mergeAndSort();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('│');
    console.log(`└── Complete in ${duration}s (${activeNames.toLocaleString()} active packages)\n`);

  } catch (err) {
    console.error('└── Error:', err.message);
    process.exit(1);
  }
}

main();
