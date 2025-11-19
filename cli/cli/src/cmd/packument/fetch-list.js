import { basename, resolve, extname } from 'node:path';
import { readFileSync } from 'node:fs';
import process from 'node:process';
import pMap from 'p-map';
import npa from 'npm-package-arg';
import { PackumentClient } from '@_all_docs/packument';

/**
 * Parse a text file containing package names
 * @param {string} filepath - Path to the text file
 * @returns {string[]} Array of package names
 */
function parseTextFile(filepath) {
  const content = readFileSync(filepath, 'utf8');
  const lines = content.split('\n');
  const packages = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    try {
      // Use npm-package-arg to properly parse package specs
      // This handles scoped packages, versions, tags, etc.
      const parsed = npa(trimmed);

      // Get the package name (works for both regular and scoped packages)
      if (parsed.name) {
        packages.push(parsed.name);
      }
    } catch (err) {
      // Log warning but continue processing other packages
      console.warn(`Warning: Invalid package spec "${trimmed}": ${err.message}`);
    }
  }

  return packages;
}

export const command = async cli => {
  const fullpath = resolve(process.cwd(), cli._[0] ?? 'npm-high-impact.json');
  const filename = basename(fullpath);
  const ext = extname(fullpath).toLowerCase();

  // Load package names based on file type
  let packageNames;
  if (ext === '.json') {
    const { default: jsonData } = await import(fullpath, { with: { type: 'json' } });
    packageNames = Array.isArray(jsonData) ? jsonData : [jsonData];
  } else if (ext === '.txt' || ext === '.text' || ext === '') {
    // Support .txt, .text, or no extension for text files
    packageNames = parseTextFile(fullpath);
  } else {
    throw new Error(`Unsupported file type: ${ext}. Use .json or .txt files.`);
  }

  const { length } = packageNames;
  console.log(`Fetching ${length} packuments from ${filename}`);

  // Get the registry URL from config
  const registryUrl = cli.getRegistry();

  // Create environment for storage driver
  const env = {
    RUNTIME: 'node',
    CACHE_DIR: cli.dir('packuments'),
    NPM_REGISTRY: registryUrl
  };

  const client = new PackumentClient({
    origin: registryUrl,
    authToken: cli.authToken,
    auth: cli.auth,
    limit: cli.values.limit,
    dryRun: cli.values.dryRun,
    env
  });

  let fetched = 0;
  await pMap(packageNames, async name => {
    const prefix = `Fetch packument | ${name}`;

    console.log(prefix);
    await client.request(name);
    fetched += 1;
    console.log(`${prefix} | ok | ${((fetched / length) * 100).toFixed(2)}%`);
  }, { concurrency: 10 });
};
