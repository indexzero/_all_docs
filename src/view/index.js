/**
 * View module - predicate + projection over cached data
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
