import { ViewStore, joinViews, diffViews } from '@_all_docs/view';
import { Cache, createStorageDriver } from '@_all_docs/cache';

export const usage = `Usage: _all_docs view join <left-view> <right-view> [options]

Join two views on their common key (package name).

Join Types:
  --left     Include all from left, matching from right (default)
  --inner    Only include records present in both views
  --right    Include all from right, matching from left
  --full     Include all records from both views
  --diff     Output records in left but not in right

Options:
  --on <field>     Join key field (default: name)
  --limit <n>      Maximum records to return
  --json           Output as ndjson (default)

Examples:
  _all_docs view join npm-packages cgr-packages
  _all_docs view join npm-packages cgr-packages --inner
  _all_docs view join npm-packages cgr-packages --diff
  _all_docs view join npm-versions cgr-versions --limit 1000
`;

export const command = async (cli) => {
  if (cli.values.help) {
    console.log(usage);
    return;
  }

  const leftName = cli._[0];
  const rightName = cli._[1];

  if (!leftName || !rightName) {
    console.error('Error: Two view names required');
    console.error('Usage: _all_docs view join <left-view> <right-view>');
    process.exit(1);
  }

  const store = new ViewStore(cli.dir('config'));

  let leftView, rightView;
  try {
    leftView = await store.load(leftName);
    rightView = await store.load(rightName);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  const driver = await createStorageDriver({ CACHE_DIR: cli.dir('packuments') });
  const cache = new Cache({ path: cli.dir('packuments'), driver });

  // Determine join type
  let type = 'left';
  if (cli.values.inner) type = 'inner';
  else if (cli.values.right) type = 'right';
  else if (cli.values.full) type = 'full';

  const options = {
    type,
    on: cli.values.on || 'name',
    limit: cli.values.limit ? parseInt(cli.values.limit, 10) : undefined
  };

  try {
    // Special case for diff
    if (cli.values.diff) {
      for await (const record of diffViews(leftView, rightView, cache, options)) {
        console.log(JSON.stringify(record));
      }
      return;
    }

    // Regular join
    for await (const record of joinViews(leftView, rightView, cache, options)) {
      console.log(JSON.stringify(record));
    }
  } catch (err) {
    console.error(`Error joining views: ${err.message}`);
    process.exit(1);
  }
};
