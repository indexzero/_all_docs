import { ViewStore } from '@_all_docs/view';

export const usage = `Usage: _all_docs view show <name>

Show details of a defined view.

Options:
  --json    Output as JSON

Examples:
  _all_docs view show npm-versions
  _all_docs view show npm-versions --json
`;

export const command = async (cli) => {
  if (cli.values.help) {
    console.log(usage);
    return;
  }

  const name = cli._[0];
  if (!name) {
    console.error('Error: View name required');
    console.error('Usage: _all_docs view show <name>');
    process.exit(1);
  }

  const store = new ViewStore(cli.dir('config'));

  try {
    const view = await store.load(name);

    if (cli.values.json) {
      console.log(JSON.stringify(view.toJSON(), null, 2));
      return;
    }

    console.log(`View: ${view.name}`);
    console.log('');
    console.log(`  Origin:     ${view.origin}`);
    if (view.registry) {
      console.log(`  Registry:   ${view.registry}`);
    }
    console.log(`  Type:       ${view.type}`);
    if (view.select) {
      console.log(`  Select:     ${view.select}`);
    }
    console.log(`  Created:    ${view.createdAt}`);
    console.log('');
    console.log(`Cache key prefix: ${view.getCacheKeyPrefix()}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
};
