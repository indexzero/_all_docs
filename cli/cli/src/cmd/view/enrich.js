import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { Cache, createStorageDriver, createPackumentKey } from '@_all_docs/cache';

export const usage = `Usage: _all_docs view enrich [options]

Enrich package specs with fields from cached packuments.

Options:
  -i, --input <file>    Input NDJSON file ('-' for stdin)
  --add <expr>          Add field from packument (repeatable)
  --origin <origin>     Packument origin (default: npm)
  --name-field <f>      Input field for name (default: name)
  --version-field <f>   Input field for version (default: version)
  --on-missing <mode>   skip, null, or error (default: null)
  --progress            Show progress

Add Expression Syntax:
  <selector> as <alias>

  Use .field to reference input record fields:
    time[.version] as addedAt
    versions[.version].dist.integrity as integrity

Examples:
  # Add publish dates
  _all_docs view enrich -i specs.ndjson --add 'time[.version] as addedAt'

  # Add multiple fields
  _all_docs view enrich -i specs.ndjson \\
    --add 'time[.version] as publishedAt' \\
    --add 'versions[.version].dist.integrity as integrity'
`;

export const command = async (cli) => {
  if (cli.values.help) {
    console.log(usage);
    return;
  }

  // Parse command-specific args
  const { values } = parseArgs({
    args: cli._,
    options: {
      input: { type: 'string', short: 'i' },
      add: { type: 'string', multiple: true },
      origin: { type: 'string', default: 'npm' },
      'name-field': { type: 'string', default: 'name' },
      'version-field': { type: 'string', default: 'version' },
      'on-missing': { type: 'string', default: 'null' },
      progress: { type: 'boolean', default: false }
    },
    allowPositionals: true
  });

  // Also check cli.values for global flags
  const input = values.input || cli.values.input;
  const addExprs = values.add || cli.values.add || [];
  const origin = values.origin || cli.values.origin || 'npm';
  const nameField = values['name-field'] || cli.values['name-field'] || 'name';
  const versionField = values['version-field'] || cli.values['version-field'] || 'version';
  const onMissing = values['on-missing'] || cli.values['on-missing'] || 'null';
  const showProgress = values.progress || cli.values.progress;

  if (!input) {
    console.error('Error: --input required');
    console.log(usage);
    process.exit(1);
  }

  if (!addExprs || addExprs.length === 0) {
    console.error('Error: at least one --add expression required');
    process.exit(1);
  }

  // Parse add expressions
  const enrichments = addExprs.map(parseAddExpression);

  // Setup cache
  const driver = await createStorageDriver({ CACHE_DIR: cli.dir('packuments') });
  const cache = new Cache({ path: cli.dir('packuments'), driver });

  // Packument cache (avoid re-fetching for same package)
  const packumentCache = new Map();

  // Setup input stream
  const inputStream = input === '-'
    ? process.stdin
    : createReadStream(input);

  const rl = createInterface({ input: inputStream, crlfDelay: Infinity });

  let processed = 0;
  let enriched = 0;
  let skipped = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    processed++;
    if (showProgress && processed % 1000 === 0) {
      process.stderr.write(`\rProcessed ${processed}, enriched ${enriched}, skipped ${skipped}...`);
    }

    try {
      const record = JSON.parse(line);
      const name = record[nameField];

      if (!name) {
        if (onMissing === 'skip') { skipped++; continue; }
        if (onMissing === 'error') throw new Error('Missing name field');
        console.log(line); // Pass through unchanged
        continue;
      }

      // Get packument (cached)
      let packument = packumentCache.get(name);
      if (packument === undefined) {
        const key = createPackumentKey(name, origin === 'npm' ? 'https://registry.npmjs.org' : origin);
        try {
          const entry = await cache.fetch(key);
          packument = entry?.body || entry || null;
        } catch {
          packument = null;
        }
        packumentCache.set(name, packument);
      }

      if (!packument) {
        if (onMissing === 'skip') { skipped++; continue; }
        if (onMissing === 'error') {
          throw new Error(`Packument not found: ${name}`);
        }
        // null mode: output with null values
        for (const e of enrichments) {
          record[e.alias] = null;
        }
        console.log(JSON.stringify(record));
        continue;
      }

      // Apply enrichments
      for (const enrichment of enrichments) {
        const value = extractValue(packument, enrichment.selector, record);
        record[enrichment.alias] = value;
      }

      console.log(JSON.stringify(record));
      enriched++;

    } catch (err) {
      if (onMissing === 'error') {
        throw err;
      }
      console.error(`Error processing line ${processed}: ${err.message}`);
    }
  }

  if (showProgress) {
    process.stderr.write(`\rCompleted: ${processed} processed, ${enriched} enriched, ${skipped} skipped\n`);
  }
};

/**
 * Parse "selector as alias" expression
 * @param {string} expr - Expression like "time[.version] as addedAt"
 * @returns {{ selector: string, alias: string }}
 */
export function parseAddExpression(expr) {
  const match = expr.match(/^(.+?)\s+as\s+(\w+)$/);
  if (!match) {
    throw new Error(`Invalid --add expression: ${expr}\nExpected: <selector> as <alias>`);
  }
  return {
    selector: match[1].trim(),
    alias: match[2].trim()
  };
}

/**
 * Extract value from packument using selector with record field references
 * @param {object} packument - The packument data
 * @param {string} selector - Selector with optional .field references
 * @param {object} record - Input record for .field resolution
 * @returns {*} The extracted value
 */
export function extractValue(packument, selector, record) {
  // Replace .field references with actual values from record
  const resolvedSelector = selector.replace(/\[\.(\w+)\]/g, (_, field) => {
    const val = record[field];
    if (val === undefined) return '[null]';
    // Escape special characters in the value
    const escaped = String(val).replace(/"/g, '\\"');
    return `["${escaped}"]`;
  });

  // Now evaluate the selector against packument
  return evaluateSelector(packument, resolvedSelector);
}

/**
 * Simple selector evaluation
 * Handles: field.nested, field["key"], field[0]
 * @param {object} obj - Object to evaluate against
 * @param {string} selector - Selector path
 * @returns {*} The value at the path
 */
export function evaluateSelector(obj, selector) {
  // Parse selector into segments
  const parts = [];
  let current = '';
  let inBracket = false;
  let bracketContent = '';

  for (let i = 0; i < selector.length; i++) {
    const char = selector[i];

    if (char === '[' && !inBracket) {
      if (current) {
        parts.push({ type: 'field', value: current });
        current = '';
      }
      inBracket = true;
      bracketContent = '';
    } else if (char === ']' && inBracket) {
      // Remove quotes from bracket content if present
      let key = bracketContent;
      if ((key.startsWith('"') && key.endsWith('"')) ||
          (key.startsWith("'") && key.endsWith("'"))) {
        key = key.slice(1, -1);
      }
      parts.push({ type: 'bracket', value: key });
      inBracket = false;
    } else if (char === '.' && !inBracket) {
      if (current) {
        parts.push({ type: 'field', value: current });
        current = '';
      }
    } else if (inBracket) {
      bracketContent += char;
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push({ type: 'field', value: current });
  }

  // Traverse the object
  let result = obj;
  for (const part of parts) {
    if (result === null || result === undefined) return null;

    if (part.type === 'bracket') {
      result = result[part.value];
    } else {
      result = result[part.value];
    }
  }

  return result ?? null;
}
