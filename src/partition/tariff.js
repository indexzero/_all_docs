import { createRequire } from 'module';

async function tariff(subpath, mod = '@vltpkg/registry-client') {
  const require = createRequire(import.meta.url);
  const scriptPath = require.resolve(`./node_modules/${mod}/dist/esm/${subpath}`);
  return await import(scriptPath);
}

export default tariff;
