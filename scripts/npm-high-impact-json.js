const { writeFileSync } = require('node:fs');
const { npmHighImpact } = require('npm-high-impact');

const argv = require('minimist')(process.argv.slice(2));
const filename = argv._[0] || 'npm-high-impact.json';

writeFileSync(filename, JSON.stringify(npmHighImpact, null, 2), 'utf8');
