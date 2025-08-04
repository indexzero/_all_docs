
import { writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';
import process from 'node:process';
import { jack } from 'jackspeak';
import pkg from '../package.json' with { type: 'json' };

const required = ['description'];
const defaults = {
  version: pkg.version,
  main: 'index.js',
  type: pkg.type,
  repository: pkg.repository,
  author: pkg.author,
  license: pkg.license,
  scripts: {
    test: 'node --test test/index.test.js'
  },
  bugs: pkg.bugs,
  homepage: pkg.homepage
};

const rootDir = join(import.meta.dirname, '..');

function mkpkg({ target, values }) {
  const contents = {

    name: `@_all_docs/${basename(target)}`,
    description: values.description, // TODO (cjr) what other values get plumbed in here?

    ...defaults
  };

  // We assume a monorepo so the target is relative to the root directory
  contents.repository.directory = target;

  for (const key of required) {
    if (!contents[key]) {
      throw new Error(`Missing required field: ${key}`);
    }
  }

  const text = JSON.stringify(contents, null, 2);
  if (target) {
    writeFileSync(join(rootDir, target, 'package.json'), text);
    console.log(`Created package.json file at ${target}`);
  } else {
    console.log('No target specified. Printing to stdout.');
  }

  console.log(text);
}

function main() {
  const ack = jack({
    envPrefix: 'all_docs',
    allowPositional: true,
    usage: 'mkpkg [options] <path>'
  })
    .heading('mkpkg - Create a package.json file')
    .opt({
      description: {
        short: 'd',
        hint: 'string',
        type: 'string',
        description: 'Sets the "description" field in the package.json file'
      }
    })
    .flag({
      version: {
        short: 'v',
        description: 'Display current mkpkg version'
      }
    })
    .flag({
      help: {
        short: 'h',
        description: 'Display helpful information about mkpkg'
      }
    });

  const { positionals, values } = ack.parse(process.argv);
  const [target] = positionals;
  console.log({ positionals, values, target });
  if (ack.version) {
    console.log(pkg.version);
    return process.exit(0);
  }

  if (ack.help) {
    console.log(ack.usage());
    return process.exit(0);
  }

  mkpkg({ target, values });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  main();
}
