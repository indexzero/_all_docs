import { createRequire } from 'node:module';

async function unstable(subpath, mod = '@vltpkg/registry-client') {
  const require = createRequire(import.meta.url);
  const scriptPath = require.resolve(`./node_modules/${mod}/dist/esm/${subpath}`);
  return await import(scriptPath);
}

export default unstable;
