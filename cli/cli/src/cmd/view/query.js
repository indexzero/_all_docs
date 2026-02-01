import { ViewStore, queryView, countView, collectView } from '@_all_docs/view';
import { Cache, createStorageDriver, isLocalPath } from '@_all_docs/cache';

export const usage = `Usage: _all_docs view query <name> [options]

Query a defined view, outputting matching records.

Options:
  --limit <n>      Maximum records to return
  --count          Only output the count of matching records
  --filter <expr>  Filter expression (e.g., "name=lodash", "versions|length>10")
  --format <fmt>   Output format: ndjson (default), lines, json
                   - ndjson: One JSON object per line (streaming)
                   - lines: Plain text, one value per line
                   - json: Complete JSON array

Examples:
  _all_docs view query npm-packages
  _all_docs view query npm-versions --limit 100
  _all_docs view query npm-packages --count
  _all_docs view query npm-packages --filter "name=lodash"
  _all_docs view query npm-packages --format json > packages.json
  _all_docs view query npm-packages --select 'name' --format lines | wc -l
`;

export const command = async (cli) => {
  if (cli.values.help) {
    console.log(usage);
    return;
  }

  const name = cli._[0];
  if (!name) {
    console.error('Error: View name required');
    console.error('Usage: _all_docs view query <name>');
    process.exit(1);
  }

  const store = new ViewStore(cli.dir('config'));

  let view;
  try {
    view = await store.load(name);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  // Create appropriate storage driver based on view's origin
  const origin = view.registry || view.origin;
  const driver = isLocalPath(origin)
    ? await createStorageDriver({ LOCAL_DIR: origin })
    : await createStorageDriver({ CACHE_DIR: cli.dir('packuments') });
  const cache = new Cache({ path: origin, driver });

  const options = {
    limit: cli.values.limit ? parseInt(cli.values.limit, 10) : undefined,
    where: cli.values.filter || undefined
  };

  try {
    if (cli.values.count) {
      const count = await countView(view, cache, options);
      console.log(count);
      return;
    }

    // Determine format (--collect is alias for --format json for backwards compat)
    const format = cli.values.collect ? 'json' : (cli.values.format || 'ndjson');

    // Validate format
    if (!['ndjson', 'lines', 'json'].includes(format)) {
      console.error(`Unknown format: ${format}`);
      console.error('Valid formats: ndjson, lines, json');
      process.exit(1);
    }

    // Collect results for json format
    const results = [];

    for await (const record of queryView(view, cache, options)) {
      switch (format) {
        case 'ndjson':
          console.log(JSON.stringify(record));
          break;

        case 'lines': {
          const values = Object.values(record);
          if (values.length === 1) {
            // Single field: output as-is (string) or JSON (other types)
            const val = values[0];
            console.log(typeof val === 'string' ? val : JSON.stringify(val));
          } else {
            // Multiple fields: tab-separated
            console.log(values.map(v =>
              typeof v === 'string' ? v : JSON.stringify(v)
            ).join('\t'));
          }
          break;
        }

        case 'json':
          results.push(record);
          break;
      }
    }

    // Output collected results for json format
    if (format === 'json') {
      console.log(JSON.stringify(results, null, 2));
    }
  } catch (err) {
    console.error(`Error querying view: ${err.message}`);
    process.exit(1);
  }
};
