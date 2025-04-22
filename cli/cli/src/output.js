
async function outputCommand({ command, usage, name }, cli) {
  if (!command) {
    console.error(cli.usage());
    console.error(`Error: Command not found '${name}'`);
    process.exit(1);
  }

  if (cli.values.help) {
    console.log(usage().usage());
    return;
  }

  const result = await command(cli);

  if (result) {
    console.dir(result);
  }
}

export {
  outputCommand
}
