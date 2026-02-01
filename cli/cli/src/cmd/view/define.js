import { View, ViewStore } from '@_all_docs/view';
import { encodeOrigin } from '@_all_docs/cache';

export const usage = `Usage: _all_docs view define <name> [options]

Define a named view over cached registry data.

A view is a predicate (origin filter) plus a projection (field selection).
Views are stored as JSON files and can be queried or joined.

Options:
  --origin <key>       Origin key (e.g., npm, paces.exale.com~javpt)
  --registry <url>     Registry URL (converted to origin key internally)
  --type <type>        Entity type: packument (default) or partition
  --select <expr>      Field selection expression

Select Expression Syntax:
  Simple fields:       name, version, description
  Nested fields:       time.modified, repository.url
  With transforms:     versions|keys, dependencies|length
  With aliases:        versions|keys as version_list

Available Transforms:
  keys, values         Object to array
  length               Array/string length
  first, last          First/last element
  sort, reverse        Sort/reverse array
  unique, compact      Dedupe/remove nulls
  flatten              Flatten nested arrays

Examples:
  _all_docs view define npm-packages --origin npm
  _all_docs view define npm-versions --origin npm --select 'name, versions|keys as versions, time'
  _all_docs view define private --registry https://npm.company.com --select 'name, versions|keys'
`;

export const command = async (cli) => {
  if (cli.values.help) {
    console.log(usage);
    return;
  }

  const name = cli._[0];
  if (!name) {
    console.error('Error: View name required');
    console.error('Usage: _all_docs view define <name> --origin <key> [--select <expr>]');
    process.exit(1);
  }

  // Validate name
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
    console.error('Error: View name must start with a letter and contain only letters, numbers, underscores, and hyphens');
    process.exit(1);
  }

  // Prioritize --registry if specified, otherwise use --origin
  // Note: cli.values.origin has a default from jack.js, so we check registry first
  let origin;
  if (cli.values.registry) {
    origin = encodeOrigin(cli.values.registry);
  } else if (cli.values.origin && cli.values.origin !== 'https://replicate.npmjs.com') {
    // User explicitly set --origin (not the default)
    origin = cli.values.origin;
  } else {
    console.error('Error: --origin or --registry required');
    console.error('Example: _all_docs view define my-view --origin npm');
    process.exit(1);
  }

  const view = new View({
    name,
    origin,
    registry: cli.values.registry || null,
    type: cli.values.type || 'packument',
    select: cli.values.select || null
  });

  const store = new ViewStore(cli.dir('config'));

  // Check if view already exists
  if (await store.exists(name)) {
    if (!cli.values.force) {
      console.error(`Error: View '${name}' already exists. Use --force to overwrite.`);
      process.exit(1);
    }
  }

  await store.save(view);

  console.log(`View '${name}' defined:`);
  console.log(`  Origin: ${origin}`);
  if (cli.values.registry) {
    console.log(`  Registry: ${cli.values.registry}`);
  }
  console.log(`  Type: ${view.type}`);
  if (view.select) {
    console.log(`  Select: ${view.select}`);
  }
};
