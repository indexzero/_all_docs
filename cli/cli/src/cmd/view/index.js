/**
 * View commands - define, query, and join views over cached data
 */
export { command as define, usage as defineUsage } from './define.js';
export { command as list, usage as listUsage } from './list.js';
export { command as show, usage as showUsage } from './show.js';
export { command as deleteView, usage as deleteUsage } from './delete.js';
export { command as query, usage as queryUsage } from './query.js';
export { command as join, usage as joinUsage } from './join.js';
export { command as enrich, usage as enrichUsage } from './enrich.js';

export const usage = `Usage: _all_docs view <command> [options]

Manage named views over cached registry data.

Commands:
  define <name>              Define a new view
  list                       List all defined views
  show <name>                Show view details
  delete <name>              Delete a view
  query <name>               Query a view (output ndjson)
  join <left> <right>        Join two views
  enrich                     Enrich NDJSON with packument data

A view is a predicate (origin filter) plus a projection (field selection).
Views enable efficient queries and joins for set operations on cached data.

Examples:
  _all_docs view define npm-pkgs --origin npm
  _all_docs view define npm-vers --origin npm --select 'name, versions|keys'
  _all_docs view list
  _all_docs view query npm-vers --limit 100
  _all_docs view join has-scripts uses-gyp --diff
`;
