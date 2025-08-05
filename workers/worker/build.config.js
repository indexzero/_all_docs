import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    './app',
    './cloudflare',
    './fastly',
    './node'
  ],
  declaration: false,
  rollup: {
    emitCJS: false,
    esbuild: {
      target: 'es2022',
      platform: 'neutral'
    }
  },
  externals: [
    // These are only needed for Node.js
    '@hono/node-server'
  ]
});