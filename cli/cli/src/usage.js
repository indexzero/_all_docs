/**
 * @attribution portions of this file are derived from vltpkg released
 * by `vlt technology, Inc.`. They are cited with @url below and reused
 * in accordance with the BSD-2-Clause-Patent license that project is
 * licensed under.
 *
 * @url https://github.com/vltpkg/vltpkg/blob/c2e235f/LICENSE
 * @url https://github.com/vltpkg/vltpkg/blob/c2e235f/src/cli-sdk/src/config/usage.ts
 */

import { jack } from 'jackspeak';
import { aliases } from './jack.js';

const toArr = v => (Array.isArray(v) ? v : [v]);

const code = v => [v, { pre: true }];

const join = (args, joiner = ' ') =>
  args.filter(Boolean).join(joiner);

export const commandUsage = ({
  command,
  usage,
  description,
  subcommands,
  examples,
  options
}) => {
  const allDocs = s => join(['_all_docs', command, s]);

  const joinUsage = usages =>
    toArr(usages).map(u => allDocs(u)).filter(Boolean).join('\n');

  const j = jack({ usage: joinUsage(usage) }).description(description);

  const knownAliases = aliases[command];
  if (knownAliases) {
    j.heading('Aliases', 2).description(knownAliases.join(', '), {
      pre: true
    });
  }

  if (subcommands) {
    j.heading('Subcommands', 2);
    for (const [k, v] of Object.entries(subcommands)) {
      j.heading(k, 3)
        .description(v.description)
        .description(
          ...code(joinUsage(toArr(v.usage).map(u => join([k, u]))))
        );
    }
  }

  if (examples) {
    j.heading('Examples', 2);
    for (const [k, v] of Object.entries(examples)) {
      j.description(v.description).description(...code(allDocs(k)));
    }
  }

  if (options) {
    j.heading('Options', 2);
    for (const [k, v] of Object.entries(options)) {
      j.heading(k, 3)
        .description(v.description)
        .description(
          ...code(
            join(['--', k, v.value ? '=' : undefined, v.value], '')
          )
        );
    }
  }

  return j;
};
