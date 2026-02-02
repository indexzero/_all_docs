import { ViewStore } from '@_all_docs/view';

export const usage = `Usage: _all_docs view delete <name>

Delete a defined view.

Options:
  --force    Skip confirmation

Examples:
  _all_docs view delete old-view
  _all_docs view delete old-view --force
`;

export const command = async (cli) => {
  if (cli.values.help) {
    console.log(usage);
    return;
  }

  const name = cli._[0];
  if (!name) {
    console.error('Error: View name required');
    console.error('Usage: _all_docs view delete <name>');
    process.exit(1);
  }

  const store = new ViewStore(cli.dir('config'));

  if (!await store.exists(name)) {
    console.error(`Error: View '${name}' does not exist`);
    process.exit(1);
  }

  await store.delete(name);
  console.log(`View '${name}' deleted`);
};
