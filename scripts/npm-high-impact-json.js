const { writeFileSync } = require('node:fs');
const { npmHighImpact } = require('npm-high-impact');

const filename = process.argv[2] || 'npm-high-impact.json';

writeFileSync(filename, JSON.stringify(npmHighImpact, null, 2), 'utf8');
