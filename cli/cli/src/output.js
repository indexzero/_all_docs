import process from 'node:process';

async function outputCommand({ command, usage, name }, cli) {
  if (!command) {
    console.error(cli.usage());
    console.error(`Error: Command not found '${name}'`);
    process.exit(1);
  }

  if (cli.values.help) {
    if (typeof usage === 'string') {
      console.log(usage);
    } else if (typeof usage === 'function') {
      console.log(usage().usage());
    } else {
      console.log(cli.usage());
    }
    return;
  }

  const result = await command(cli);

  if (result) {
    console.dir(result);
  }
}

export { outputCommand };
