import { ViewStore } from '@_all_docs/view';

export const usage = `Usage: _all_docs view list

List all defined views.

Options:
  --json    Output as JSON array

Examples:
  _all_docs view list
  _all_docs view list --json
`;

export const command = async (cli) => {
  if (cli.values.help) {
    console.log(usage);
    return;
  }

  const store = new ViewStore(cli.dir('config'));
  const names = await store.list();

  if (names.length === 0) {
    console.log('No views defined.');
    console.log('');
    console.log('Create a view with:');
    console.log('  _all_docs view define <name> --origin <key> [--select <expr>]');
    return;
  }

  if (cli.values.json) {
    const views = [];
    for (const name of names) {
      const view = await store.load(name);
      views.push(view.toJSON());
    }
    console.log(JSON.stringify(views, null, 2));
    return;
  }

  console.log('Defined views:');
  console.log('');

  for (const name of names) {
    try {
      const view = await store.load(name);
      console.log(`  ${name}`);
      console.log(`    Origin: ${view.origin}`);
      console.log(`    Type: ${view.type}`);
      if (view.select) {
        console.log(`    Select: ${view.select}`);
      }
      console.log('');
    } catch (err) {
      console.log(`  ${name} (error loading: ${err.message})`);
    }
  }
};
