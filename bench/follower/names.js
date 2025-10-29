#!/usr/bin/env node

/**
 * names.js
 *
 * Extracts all npm package names from JSONL change files and creates
 * a lexographically sorted, deduplicated array.
 *
 * Process:
 * 1. Stream all data/*.jsonl files
 * 2. Extract "id" field from each JSON line
 * 3. Write all names to names/raw.txt
 * 4. Deduplicate and sort into names/all.json
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
const ALL_FILE = join(NAMES_DIR, 'all.json');

/**
 * Stream all JSONL files and extract package names to raw.txt
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
    return 0;
  }

  console.log(`│   ├── Found ${files.length} JSONL files`);

  const output = createWriteStream(RAW_FILE, { flags: 'w' });
  let totalNames = 0;
  let filesProcessed = 0;

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
          output.write(change.id + '\n');
          lineCount++;
          totalNames++;
        }
      } catch (err) {
        // Skip malformed JSON lines
        continue;
      }
    }

    filesProcessed++;
    const filename = file.split('/').pop();
    console.log(`│   ├── Processed ${filename}: ${lineCount.toLocaleString()} names`);
  }

  output.end();

  await new Promise((resolve, reject) => {
    output.on('finish', resolve);
    output.on('error', reject);
  });

  console.log(`│   └── Extracted ${totalNames.toLocaleString()} total names to raw.txt`);
  return totalNames;
}

/**
 * Deduplicate and sort raw.txt into all.json
 */
async function deduplicateAndSort() {
  console.log('├── Deduplicating and sorting names');

  const names = new Set();
  let duplicates = 0;

  const rl = createInterface({
    input: createReadStream(RAW_FILE),
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const name = line.trim();
    if (name) {
      const sizeBefore = names.size;
      names.add(name);
      if (names.size === sizeBefore) {
        duplicates++;
      }
    }
  }

  console.log(`│   ├── Found ${names.size.toLocaleString()} unique names`);
  console.log(`│   ├── Removed ${duplicates.toLocaleString()} duplicates`);
  console.log(`│   ├── Sorting lexographically...`);

  const sorted = Array.from(names).sort();

  console.log(`│   ├── Writing to all.json...`);

  await mkdir(dirname(ALL_FILE), { recursive: true });
  const output = createWriteStream(ALL_FILE);

  // Write JSON array efficiently
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
    const totalNames = await extractNames();

    if (totalNames === 0) {
      console.log('└── No names to process\n');
      return;
    }

    const uniqueNames = await deduplicateAndSort();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const dedupePercent = ((1 - uniqueNames / totalNames) * 100).toFixed(1);

    console.log('│');
    console.log(`└── Complete in ${duration}s (${dedupePercent}% deduplication)\n`);

  } catch (err) {
    console.error('└── Error:', err.message);
    process.exit(1);
  }
}

main();
