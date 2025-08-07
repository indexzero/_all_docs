#!/usr/bin/env node
import process from 'node:process';
import run from '../src/index.js';

await run(process.argv);
