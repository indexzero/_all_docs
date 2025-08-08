import { createServer } from 'node:http';

export function createMockRegistry() {
  const server = createServer((req, res) => {
    // Mock _all_docs endpoint
    if (req.url.includes('/_all_docs')) {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const startKey = url.searchParams.get('startkey');
      const endKey = url.searchParams.get('endkey');
      
      res.writeHead(200, { 
        'content-type': 'application/json',
        'cache-control': 'max-age=300',
        'etag': `"${startKey}-${endKey}-mock"`
      });
      res.end(JSON.stringify({
        total_rows: 1000,
        offset: 0,
        rows: [
          { id: startKey, key: startKey, value: { rev: '1-abc' } },
          { id: `${startKey}a`, key: `${startKey}a`, value: { rev: '1-def' } },
          { id: `${startKey}b`, key: `${startKey}b`, value: { rev: '1-ghi' } }
        ]
      }));
      return;
    }
    
    // Mock packument endpoint
    const packageMatch = req.url.match(/^\/([^/]+)$/);
    if (packageMatch) {
      const packageName = packageMatch[1];
      
      // Handle 404 for non-existent packages
      if (packageName.includes('definitely-does-not-exist')) {
        res.writeHead(404, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }
      
      res.writeHead(200, { 
        'content-type': 'application/json',
        'cache-control': 'max-age=300',
        'etag': `"${packageName}-v1"`
      });
      res.end(JSON.stringify({
        name: packageName,
        'dist-tags': { latest: '1.0.0' },
        description: `A mock package for ${packageName}`,
        readme: `# ${packageName}\n\nThis is a mock readme for testing purposes.`,
        maintainers: [{ name: 'mockuser', email: 'mock@example.com' }],
        time: {
          created: '2023-01-01T00:00:00.000Z',
          modified: '2023-06-01T00:00:00.000Z',
          '1.0.0': '2023-01-01T00:00:00.000Z'
        },
        versions: {
          '1.0.0': {
            name: packageName,
            version: '1.0.0',
            description: `A mock package for ${packageName}`,
            main: 'index.js',
            dependencies: packageName === 'express' ? { 'body-parser': '^1.0.0' } : {},
            devDependencies: {},
            scripts: { test: 'echo "Error: no test specified" && exit 1' },
            repository: { type: 'git', url: `git+https://github.com/mock/${packageName}.git` },
            author: 'Mock Author',
            license: 'MIT',
            dist: {
              tarball: `http://${req.headers.host}/${packageName}/-/${packageName}-1.0.0.tgz`,
              shasum: 'mockshasum123',
              integrity: 'sha512-mockintegrity=='
            }
          }
        }
      }));
      return;
    }
    
    // Default 404
    res.writeHead(404);
    res.end();
  });
  
  return server;
}

/**
 * Start mock registry on a random port
 * @returns {Promise<{server: import('http').Server, port: number, url: string}>}
 */
export async function startMockRegistry() {
  const server = createMockRegistry();
  
  return new Promise((resolve) => {
    server.listen(0, () => {
      const port = server.address().port;
      resolve({
        server,
        port,
        url: `http://localhost:${port}`
      });
    });
  });
}

/**
 * Stop mock registry
 * @param {import('http').Server} server
 * @returns {Promise<void>}
 */
export async function stopMockRegistry(server) {
  return new Promise((resolve) => {
    server.close(() => resolve());
  });
}