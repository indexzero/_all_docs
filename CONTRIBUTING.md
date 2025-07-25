# Contributing to @_all_docs

## Development Setup

This monorepo uses pnpm for package management. To get started:

```bash
# Install dependencies
pnpm install

# Run tests across all packages
pnpm test

# Run tests for a specific package
pnpm --filter @_all_docs/partition test
```

## Making Changes

### Creating a Changeset

When you make changes that should be released, you need to create a changeset:

```bash
# Create a new changeset
pnpm changeset

# Follow the prompts to:
# 1. Select which packages have changed
# 2. Choose the version bump type (patch/minor/major)
# 3. Write a summary of your changes
```

This will create a file in `.changeset/` describing your changes. Commit this file along with your code changes.

### Version Bumps

- **patch**: Bug fixes and minor updates (0.0.x)
- **minor**: New features that are backward compatible (0.x.0)
- **major**: Breaking changes (x.0.0)

## Release Process

Releases are automated via GitHub Actions when changes are merged to the `main` branch:

1. When changesets are merged to `main`, the GitHub Action creates a "Version Packages" PR
2. This PR updates the package versions and changelogs
3. When the Version Packages PR is merged, packages are automatically published to npm

## Package Structure

- `src/` - Core packages
  - `cache/` - Cache management
  - `config/` - Configuration
  - `exec/` - Execution utilities
  - `frame/` - Frame utilities
  - `packument/` - Package document handling
  - `partition/` - Partition management
- `cli/` - Command-line interfaces

## Testing

Each package should have its own tests. Run tests with:

```bash
# All packages
pnpm test

# Specific package
pnpm --filter @_all_docs/partition test
```