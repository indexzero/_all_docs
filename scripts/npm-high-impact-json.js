import { writeFileSync } from 'node:fs';
import process from 'node:process';
import { npmHighImpact } from 'npm-high-impact';

const filename = process.argv[2] || 'npm-high-impact.json';

writeFileSync(filename, JSON.stringify(npmHighImpact, null, 2), 'utf8');
