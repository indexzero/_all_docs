/**
 * View module - predicate + projection over cached data
 *
 * For local directory support, use createStorageDriver({ LOCAL_DIR: path })
 * from @_all_docs/cache when creating the cache instance.
 */
export { View } from './view.js';
export { ViewStore } from './store.js';
export { queryView, countView, collectView } from './query.js';
export { joinViews, diffViews } from './join.js';
export {
  compileSelector,
  compileFilter,
  createProjection,
  createFilter
} from './projection.js';
