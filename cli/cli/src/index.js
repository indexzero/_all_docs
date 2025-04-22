/**
 *
 * @attribution portions of this file are derived from vltpkg released
 * by `vlt technology, Inc.`. They are cited with @url below and reused
 * in accordance with the BSD-2-Clause-Patent license that project is
 * licensed under.
 *
 * @url https://github.com/vltpkg/vltpkg/blob/c2e235f/LICENSE
 * @url https://github.com/vltpkg/vltpkg/blob/c2e235f/src/cli-sdk/src/cli-sdk/src/config/index.ts#L305-L338
 */
import { error } from '@vltpkg/error-cause'

import Config from '@_all_docs/config';

import { getCommand, cli } from './jack.js';
import { outputCommand } from './output.js';

/**
 * Parse the arguments and set configuration and positionals accordingly.
 */
function parse(argh) {
  cli.loadEnvDefaults()
  const raw = cli.parseRaw(argh)

  const fallback = getCommand(raw.values['fallback-command']);
  let isCommand = getCommand(raw.positionals[0])

  cli.applyDefaults(raw)
  cli.writeEnv(raw)

  const command = isCommand
    ? getCommand(raw.positionals.shift())
    : fallback;

  // This should likely be checked on a per command basis
  const subcommand = raw.positionals.shift();

  return {
    command,
    subcommand,
    cli: {
      usage: () => cli.usage(),
      values: raw.values,
      _: raw.positionals,
    }
  }
}

async function importCommand(cmd, subcmd) {
  if (!cmd) {
    console.error('Error: No command provided');
    console.error(cli.usage());
    process.exit(1);
  }

  const cmdpath = `${cmd}/${subcmd}`;
  try {
    return await import(`./cmd/${cmdpath}.js`);
  } catch (e) {
    throw error('Failed to load command', {
      found: cmdpath,
      cause: e
    })
  }
}

const run = async (argh) => {
  const {
    command: cmd,
    subcommand: subcmd,
    cli
  } = parse(argh);

  const conf = new Config(cli);
  const { command, usage } = await importCommand(cmd, subcmd);
  outputCommand({ command, usage, name: cmd }, conf);
}

export default run;
