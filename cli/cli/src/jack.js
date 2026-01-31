/**
 *
 * @attribution portions of this file are derived from vltpkg released
 * by `vlt technology, Inc.`. They are cited with @url below and reused
 * in accordance with the BSD-2-Clause-Patent license that project is
 * licensed under.
 *
 * @url https://github.com/vltpkg/vltpkg/blob/c2e235f/LICENSE
 * @url https://github.com/vltpkg/vltpkg/blob/c2e235f/src/cli-sdk/src/config/definition.ts#L101-L546
 */
import { jack } from 'jackspeak';

const fullCommands = {
  help: 'help',
  cache: 'cache',
  exec: 'exec',
  packument: 'packument',
  partition: 'partition'
};

const aliases = {
  '?': 'help',
  h: 'help',
  c: 'cache',
  ch: 'cache',
  ex: 'exec',
  pku: 'packument',
  prt: 'partition'
};

const commands = {
  ...fullCommands,
  ...aliases
};

function getCommand(name) {
  return name && name in commands
    ? commands[name]
    : undefined;
}

const ack = jack({
  envPrefix: 'ALL_DOCS',
  allowPositionals: true,
  usage: '_all_docs [<options>] [<cmd> [<args> ...]]'
})
  .heading('_all_docs – Fetch & cache :origin/_all_docs using a set of lexographically sorted keys')
  .heading('Subcommands');

ack.description(Object.keys(commands).join(', '), {
  pre: true
}).description(
  'Run `_all_docs <cmd> --help` for command-specific details'
);

const cli = ack
  .opt({
    origin: {
      hint: 'url',
      default: 'https://replicate.npmjs.com',
      description: `Sets the origin for use with /_all_docs requests

                    For example, \`GET /_all_docs\`
                    will be requested from this registry origin.
      `
    },
    registry: {
      hint: 'url',
      description: `Sets the registry for use with /<packument> requests

                    For example, \`GET /winston\`
                    will be requested from this registry origin.
                    Defaults to https://registry.npmjs.org if not specified.
      `
    },
    auth: {
      hint: 'user:pass',
      description: `Basic authentication credentials in format "user:pass"

                    Used for Basic auth in Authorization header.
                    WARNING: Visible in process list. Use environment variables or .npmrc instead.
      `
    },
    token: {
      hint: 'token',
      description: `Bearer token for registry authentication

                    Used as Bearer token in Authorization header.
                    Takes precedence over Basic auth when both are provided.
      `
    },
    rcfile: {
      hint: 'path',
      description: `Path to .npmrc file for authentication

                    Defaults to ~/.npmrc if not specified.
      `
    }
  })

  .opt({
    start: {
      hint: 'string',
      description: `Sets the start key for use with /_all_docs requests

                    For example, \`GET /_all_docs?startkey=foo\`
                    will be requested from this registry origin.
      `
    },
    end: {
      hint: 'string',
      description: `Sets the end key for use with /_all_docs requests

                    For example, \`GET /_all_docs?endkey=foo\`
                    will be requested from this registry origin.
      `
    }
  })

  .flag({
    refresh: {
      short: 'r',
      default: false,
      description: 'Refresh the local disk cache for this request.'
    },
    'no-refresh': {
      short: 'R',
      description: 'Do not refresh the local disk cache for this request.'
    },
    cache: {
      short: 'd',
      default: true,
      description: 'Read from the local disk cache (if available).'
    },
    'no-cache': {
      short: 'D',
      description: 'Do not read from the local disk cache.'
    }
  })

  .opt({
    pivots: {
      hint: 'path',
      description: `Path to JavaScript file from which pivots
                    are exported from
      `
    }
  })

  .opt({
    design: {
      hint: 'path',
      description: `Path to JavaScript design document on which
                    the [exec].{view, map, reduce} functions are
                    defined.
      `
    },
    exec: {
      hint: 'string',
      description: `Named design document property on which
                    the { view, map, reduce } functions to be
                    executed are defined.
      `
    }
  })

  .flag({
    checkpoint: {
      default: true,
      description: `Enable checkpoint tracking for resumable fetch operations.

                    Progress is saved to disk and can be resumed if
                    interrupted. Enabled by default.
      `
    },
    'no-checkpoint': {
      description: `Disable checkpoint tracking.

                    Run without saving progress. Use for small lists
                    or one-off fetches.
      `
    },
    status: {
      description: `Show checkpoint status without fetching.

                    Displays progress summary for the input file's
                    checkpoint and exits.
      `
    },
    'list-failed': {
      description: `List packages that failed to fetch from checkpoint.

                    Shows all packages marked as failed in the
                    checkpoint and exits.
      `
    },
    fresh: {
      description: `Ignore existing checkpoint and start fresh.

                    Deletes any existing checkpoint for the input
                    file and begins from the start.
      `
    }
  })

  .flag({
    version: {
      short: 'v',
      description: 'Display current _all_docs version'
    }
  })

  .flag({
    help: {
      short: 'h',
      description: 'Display helpful information about _all_docs & related commands'
    }
  });

export {
  commands,
  aliases,
  getCommand,
  cli
};
