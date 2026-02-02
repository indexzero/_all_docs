import { Cache, createStorageDriver, createPackumentKey, encodeOrigin } from '@_all_docs/cache';
import { compileSelector } from '@_all_docs/view';

export const usage = `Usage: _all_docs packument show <name[@version]> [options]

Display a packument from cache or registry.

Options:
  --select <expr>   Project specific fields using selector syntax
  --registry <url>  Registry URL (default: npm)
  --origin <name>   Origin name (alternative to --registry)
  --raw             Output raw JSON without formatting

Selector Syntax:
  field             Simple field access
  field.nested      Nested field access
  field["key"]      Bracket notation (for special chars or variables)
  field|transform   Apply transform (keys, values, length, etc.)
  expr as alias     Rename output field

Examples:
  _all_docs packument show lodash
  _all_docs packument show lodash --select 'versions|keys'
  _all_docs packument show lodash --select 'time["4.17.21"]'
  _all_docs packument show lodash@4.17.21 --select 'dist.integrity'
  _all_docs packument show lodash --select 'name, versions|keys|length as versionCount'
`;

export const command = async (cli) => {
  if (cli.values.help) {
    console.log(usage);
    return;
  }

  const spec = cli._[0];
  if (!spec) {
    console.error('Error: Package name required');
    console.error('Usage: _all_docs packument show <name[@version]>');
    process.exit(1);
  }

  // Parse spec (handles scoped packages: @scope/name@version)
  const { name, version } = parseSpec(spec);

  // Determine origin
  const registry = cli.values.registry || 'https://registry.npmjs.org';
  const origin = cli.values.origin || encodeOrigin(registry);

  // Setup cache
  const driver = await createStorageDriver({ CACHE_DIR: cli.dir('packuments') });
  const cache = new Cache({ path: cli.dir('packuments'), driver });

  // Create cache key and fetch
  const cacheKey = createPackumentKey(name, registry);

  let packument;
  try {
    const entry = await cache.fetch(cacheKey);
    packument = entry?.body || entry;
  } catch (err) {
    console.error(`Error: Could not find cached packument for ${name}`);
    console.error(`Hint: Run '_all_docs packument fetch ${name}' first`);
    process.exit(1);
  }

  if (!packument) {
    console.error(`Error: Package not found in cache: ${name}`);
    console.error(`Hint: Run '_all_docs packument fetch ${name}' first`);
    process.exit(1);
  }

  // Determine what to output
  let data = packument;

  // If version specified, narrow to version-specific data
  if (version) {
    if (!packument.versions?.[version]) {
      console.error(`Error: Version not found: ${name}@${version}`);
      console.error(`Available versions: ${Object.keys(packument.versions || {}).slice(0, 10).join(', ')}...`);
      process.exit(1);
    }
    // Include version data + time field for date lookups
    data = {
      ...packument.versions[version],
      name: packument.name,
      time: packument.time
    };
  }

  // Apply projection if --select specified
  if (cli.values.select) {
    try {
      const project = compileSelector(cli.values.select);
      data = project(data);

      // If single field selected, unwrap the result
      const keys = Object.keys(data);
      if (keys.length === 1) {
        data = data[keys[0]];
      }
    } catch (err) {
      console.error(`Error: Invalid select expression: ${err.message}`);
      process.exit(1);
    }
  }

  // Output
  if (cli.values.raw) {
    console.log(JSON.stringify(data));
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
};

/**
 * Parse a package spec into name and version
 * Handles: lodash, lodash@4.17.21, @scope/name, @scope/name@version
 * @param {string} spec - Package spec
 * @returns {{ name: string, version: string|null }}
 */
function parseSpec(spec) {
  // Handle scoped packages
  if (spec.startsWith('@')) {
    // @scope/name or @scope/name@version
    const slashIndex = spec.indexOf('/');
    if (slashIndex === -1) {
      return { name: spec, version: null };
    }

    const afterSlash = spec.slice(slashIndex + 1);
    const atIndex = afterSlash.indexOf('@');

    if (atIndex === -1) {
      // @scope/name (no version)
      return { name: spec, version: null };
    } else {
      // @scope/name@version
      return {
        name: spec.slice(0, slashIndex + 1 + atIndex),
        version: afterSlash.slice(atIndex + 1)
      };
    }
  }

  // Unscoped package: name or name@version
  const atIndex = spec.indexOf('@');
  if (atIndex === -1) {
    return { name: spec, version: null };
  }

  return {
    name: spec.slice(0, atIndex),
    version: spec.slice(atIndex + 1)
  };
}
