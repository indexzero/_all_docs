import { ViewStore, queryView, countView, collectView } from '@_all_docs/view';
import { Cache, createStorageDriver } from '@_all_docs/cache';

export const usage = `Usage: _all_docs view query <name> [options]

Query a defined view, outputting matching records.

Options:
  --limit <n>      Maximum records to return
  --count          Only output the count of matching records
  --collect        Collect all results into a JSON array
  --filter <expr>  Filter expression (e.g., "name=lodash", "versions|length>10")
  --json           Output as ndjson (default)

Examples:
  _all_docs view query npm-packages
  _all_docs view query npm-versions --limit 100
  _all_docs view query npm-packages --count
  _all_docs view query npm-packages --filter "name=lodash"
  _all_docs view query npm-versions --collect > all-versions.json
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

  const driver = await createStorageDriver({ CACHE_DIR: cli.dir('packuments') });
  const cache = new Cache({ path: cli.dir('packuments'), driver });

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

    if (cli.values.collect) {
      const results = await collectView(view, cache, options);
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    // Stream ndjson output
    for await (const record of queryView(view, cache, options)) {
      console.log(JSON.stringify(record));
    }
  } catch (err) {
    console.error(`Error querying view: ${err.message}`);
    process.exit(1);
  }
};
