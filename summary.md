- **Custom registry authentication:** enables private npm registry access
  - CLI flags: `--auth-token` (Bearer), `--auth` (Basic), `--registry`, `--rcfile`
  - `BaseHTTPClient` supports both Bearer and Basic auth headers
  - Bearer token takes precedence when both provided
  - Precedence: CLI > ENV (NPM_TOKEN, _ALL_DOCS_AUTH) > .npmrc

- **Text file support:** simplifies CI/CD package list management
  - `packument fetch-list` accepts `.txt` files
  - Newline-delimited with `#` comments
  - Uses `npm-package-arg` for proper package spec parsing
  - Correctly handles scoped packages and version specs
  - Maintains JSON format compatibility

- **.npmrc parser using ini package:** ensures npm-compatible parsing
  - Synchronous parsing at startup
  - Supports Bearer tokens: `//host/:_authToken`, `//host:_authToken`
  - Supports Basic auth: `//host/:_auth` (base64-encoded user:pass)
  - Handles ports and trailing slashes

- **Error categorization:** directs retry behavior
  - `AuthError` (401/403): stop
  - `TempError` (429/5xx): retry with backoff
  - `PermError` (404/400): skip

- **Unified auth resolution:** centralizes token management
  - `Config.authToken` resolves from CLI/env/.npmrc
  - Jackspeak auto-maps environment variables
  - Registry URL normalization across commands