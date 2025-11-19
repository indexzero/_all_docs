# Authentication

The `@_all_docs/cache` project supports authentication for private npm registries and alternative registry endpoints.

## Configuration Methods

Authentication can be configured in three ways, with the following precedence:

1. **CLI flags** (highest priority)
2. **Environment variables**
3. **.npmrc file** (lowest priority)

### 1. CLI Flags

Use command-line flags for direct authentication:

```bash
# Bearer token authentication
_all_docs packument fetch-list pkgs.txt --auth-token="npm_token_here"

# Basic auth (user:pass format)
_all_docs packument fetch-list pkgs.txt --auth="username:password"

# Custom registry with Bearer token
_all_docs packument fetch-list pkgs.txt --registry="https://custom.registry.com" --auth-token="token"

# Custom registry with Basic auth
_all_docs packument fetch-list pkgs.txt --registry="https://custom.registry.com" --auth="user:pass"

# Custom .npmrc location
_all_docs packument fetch-list pkgs.txt --rcfile="/custom/path/.npmrc"
```

**Note**: Bearer token (`--auth-token`) takes precedence over Basic auth (`--auth`) when both are provided.

### 2. Environment Variables

Set environment variables for authentication:

```bash
# Bearer token (standard npm environment variable)
export NPM_TOKEN="your_token_here"

# Basic auth (jackspeak auto-maps from CLI flag)
export _ALL_DOCS_AUTH="username:password"

# npm_config_ style variables (for specific registries)
export npm_config___registry_npmjs_org___authToken="token_here"
```

### 3. .npmrc File

Configure authentication in your `.npmrc` file (default: `~/.npmrc`):

```ini
# Default registry
registry=https://registry.npmjs.org

# Bearer tokens
//registry.npmjs.org/:_authToken=npm_token_here
//custom.registry.com/:_authToken=custom_token_here

# Basic auth (base64 encoded user:pass)
//registry.npmjs.org/:_auth=dXNlcjpwYXNz
//custom.registry.com/:_auth=YWRtaW46c2VjcmV0

# Alternative format (also supported)
//registry.npmjs.org:_authToken=npm_token_here
//registry.npmjs.org:_auth=dXNlcjpwYXNz
```

**Note**: The `_auth` field must be base64-encoded. To encode credentials:
```bash
echo -n "username:password" | base64
```

## Text File Support

The `fetch-list` command now supports text files containing package names:

```bash
# Create a text file with package names
cat > packages.txt <<EOF
# Comments are supported
express
react
vue

# Scoped packages
@types/node
@babel/core

# Versions are stripped
typescript@latest
webpack@5
EOF

# Fetch all packages from the text file
_all_docs packument fetch-list packages.txt
```

## Error Handling

The authentication system categorizes HTTP errors into three types:

- **Authentication Errors (401, 403)**: Stop immediately, check credentials
- **Temporary Errors (429, 5xx)**: Retry with backoff
- **Permanent Errors (404, 400)**: Skip and continue with next item

## Implementation Details

### NpmrcParser

The `NpmrcParser` class provides synchronous parsing of .npmrc files:

```javascript
import { NpmrcParser } from '@_all_docs/config';

const parser = new NpmrcParser('/path/to/.npmrc');
const token = parser.getToken('https://registry.npmjs.org');
```

### BaseHTTPClient

The `BaseHTTPClient` class supports both Bearer token and Basic authentication:

```javascript
import { BaseHTTPClient } from '@_all_docs/cache';

// Bearer token authentication
const bearerClient = new BaseHTTPClient('https://registry.npmjs.org', {
  authToken: 'your_token_here'
});
// Adds: Authorization: Bearer your_token_here

// Basic authentication
const basicClient = new BaseHTTPClient('https://registry.npmjs.org', {
  auth: 'username:password'
});
// Adds: Authorization: Basic base64(username:password)

// Both (Bearer takes precedence)
const client = new BaseHTTPClient('https://registry.npmjs.org', {
  authToken: 'token',    // This will be used
  auth: 'user:pass'      // This will be ignored
});

await client.request('/package-name');
```

### Error Classes

Three error classes provide clear error categorization:

```javascript
import { AuthError, TempError, PermError } from '@_all_docs/cache';

try {
  await client.request('/package');
} catch (error) {
  if (error instanceof AuthError) {
    // Authentication failed - check credentials
  } else if (error instanceof TempError) {
    // Temporary failure - retry with backoff
  } else if (error instanceof PermError) {
    // Permanent failure - skip this item
  }
}
```

## Security Notes

- Auth tokens are never logged or displayed in console output
- Tokens are stored in memory only during process execution
- Use environment variables or secure .npmrc files for production
- Never commit .npmrc files with tokens to version control

## Testing

Run the authentication tests:

```bash
# Test NpmrcParser
node --test src/config/npmrc-parser.test.js

# Test HTTP client authentication
node --test src/cache/http.test.js

# Test error handling
node --test src/cache/errors.test.js
```