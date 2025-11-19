import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { NpmrcParser } from './npmrc-parser.js';

test('NpmrcParser', async (t) => {
  // Create temporary directory for test files
  const testDir = join(tmpdir(), `npmrc-test-${Date.now()}`);
  mkdirSync(testDir, { recursive: true });

  await t.test('parses basic .npmrc file', () => {
    const npmrcPath = join(testDir, 'basic.npmrc');
    const content = `
# This is a comment
registry=https://custom.registry.com

//registry.npmjs.org/:_authToken=npm_token123
//custom.registry.com/:_authToken=custom_token456
`;
    writeFileSync(npmrcPath, content);

    const parser = new NpmrcParser(npmrcPath);

    // Check registry
    assert.equal(parser.getRegistry(), 'https://custom.registry.com');

    // Check tokens
    assert.equal(parser.getToken('https://registry.npmjs.org'), 'npm_token123');
    assert.equal(parser.getToken('https://custom.registry.com'), 'custom_token456');
    assert.equal(parser.hasTokens(), true);
  });

  await t.test('handles alternative token format', () => {
    const npmrcPath = join(testDir, 'alt-format.npmrc');
    const content = `
//registry.npmjs.org:_authToken=npm_token789
//custom.registry.com:_authToken=custom_tokenXYZ
`;
    writeFileSync(npmrcPath, content);

    const parser = new NpmrcParser(npmrcPath);

    assert.equal(parser.getToken('https://registry.npmjs.org'), 'npm_token789');
    assert.equal(parser.getToken('https://custom.registry.com'), 'custom_tokenXYZ');
  });

  await t.test('normalizes registry URLs', () => {
    const npmrcPath = join(testDir, 'normalize.npmrc');
    const content = `
//registry.npmjs.org/:_authToken=token123
`;
    writeFileSync(npmrcPath, content);

    const parser = new NpmrcParser(npmrcPath);

    // Should work with various formats
    assert.equal(parser.getToken('https://registry.npmjs.org'), 'token123');
    assert.equal(parser.getToken('https://registry.npmjs.org/'), 'token123');
    assert.equal(parser.getToken('registry.npmjs.org'), 'token123');
  });

  await t.test('handles missing file gracefully', () => {
    const parser = new NpmrcParser('/non/existent/path/.npmrc');

    assert.equal(parser.getRegistry(), 'https://registry.npmjs.org');
    assert.equal(parser.hasTokens(), false);
    assert.equal(parser.getToken('https://registry.npmjs.org'), undefined);
  });

  await t.test('ignores comments and empty lines', () => {
    const npmrcPath = join(testDir, 'comments.npmrc');
    const content = `
# Comment line
; Another comment style

//registry.npmjs.org/:_authToken=token_valid

# More comments
; And more

`;
    writeFileSync(npmrcPath, content);

    const parser = new NpmrcParser(npmrcPath);

    assert.equal(parser.getToken('https://registry.npmjs.org'), 'token_valid');
    assert.equal(parser.hasTokens(), true);
  });

  await t.test('handles URLs with ports', () => {
    const npmrcPath = join(testDir, 'ports.npmrc');
    const content = `
//localhost:4873/:_authToken=local_token
//custom.registry.com:8080/:_authToken=custom_port_token
`;
    writeFileSync(npmrcPath, content);

    const parser = new NpmrcParser(npmrcPath);

    assert.equal(parser.getToken('https://localhost:4873'), 'local_token');
    assert.equal(parser.getToken('https://custom.registry.com:8080'), 'custom_port_token');
  });

  // Cleanup
  t.after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });
});