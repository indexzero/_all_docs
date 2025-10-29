#!/usr/bin/env node

/**
 * scopes.js
 *
 * Analyzes package names from names/all.json and counts packages by scope.
 * Outputs an array of tuples: [['UNSCOPED', count], ['scope1', count], ...]
 *
 * Scoped packages start with '@' (e.g., @babel/core has scope 'babel')
 * Unscoped packages are everything else (e.g., react, express)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const NAMES_DIR = join(DATA_DIR, 'names');
const INPUT_FILE = join(NAMES_DIR, 'all.json');
const OUTPUT_FILE = join(NAMES_DIR, 'scopes.json');

/**
 * Extract scope from package name
 * @param {string} name - Package name
 * @returns {string} - Scope name or 'UNSCOPED'
 */
function extractScope(name) {
  if (!name.startsWith('@')) {
    return 'UNSCOPED';
  }

  // Scoped package format: @scope/package
  const slashIndex = name.indexOf('/');
  if (slashIndex === -1) {
    // Malformed scoped package, treat as unscoped
    return 'UNSCOPED';
  }

  // Extract scope without the @ prefix
  return name.substring(1, slashIndex);
}

/**
 * Count packages by scope
 */
async function countScopes() {
  const startTime = Date.now();

  console.log('\n┌── Analyzing package scopes');

  // Read all package names
  console.log('├── Reading names/all.json');
  const names = JSON.parse(await readFile(INPUT_FILE, 'utf8'));
  console.log(`│   └── Loaded ${names.length.toLocaleString()} package names`);

  // Count by scope
  console.log('├── Counting packages by scope');
  const scopeCounts = new Map();

  for (const name of names) {
    const scope = extractScope(name);
    scopeCounts.set(scope, (scopeCounts.get(scope) || 0) + 1);
  }

  console.log(`│   ├── Found ${scopeCounts.size.toLocaleString()} unique scopes`);

  const unscopedCount = scopeCounts.get('UNSCOPED') || 0;
  const scopedCount = names.length - unscopedCount;
  console.log(`│   ├── Unscoped: ${unscopedCount.toLocaleString()} packages`);
  console.log(`│   └── Scoped: ${scopedCount.toLocaleString()} packages`);

  // Create output array with UNSCOPED first, then sorted by count
  console.log('├── Sorting scopes by package count');
  const entries = Array.from(scopeCounts.entries());

  // Separate UNSCOPED from the rest
  const unscoped = entries.find(([scope]) => scope === 'UNSCOPED');
  const scoped = entries
    .filter(([scope]) => scope !== 'UNSCOPED')
    .sort((a, b) => b[1] - a[1]); // Sort by count (descending)

  const result = unscoped ? [unscoped, ...scoped] : scoped;

  // Write output with custom formatting (one tuple per line)
  console.log('├── Writing to names/scopes.json');
  const formatted = '[\n' +
    result.map(tuple => `  ${JSON.stringify(tuple)}`).join(',\n') +
    '\n]\n';
  await writeFile(OUTPUT_FILE, formatted, 'utf8');

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const scopedPercent = ((scopedCount / names.length) * 100).toFixed(1);

  console.log('│');
  console.log(`└── Complete in ${duration}s (${scopedPercent}% scoped packages)\n`);

  // Show top 10 scopes
  console.log('Top 10 scopes by package count:');
  const top10 = result.slice(0, 11); // Include UNSCOPED + 10 more
  for (const [scope, count] of top10) {
    const bar = '█'.repeat(Math.floor(count / 10000));
    console.log(`  ${scope.padEnd(30)} ${count.toLocaleString().padStart(10)} ${bar}`);
  }
  console.log();
}

/**
 * Main execution
 */
async function main() {
  try {
    await countScopes();
  } catch (err) {
    console.error('└── Error:', err.message);
    process.exit(1);
  }
}

main();
