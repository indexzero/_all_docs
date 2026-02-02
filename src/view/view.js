/**
 * View class - represents a predicate + projection over cached data
 */
import { encodeOrigin } from '@_all_docs/cache';

export class View {
  constructor({ name, origin, registry, type = 'packument', select = null }) {
    if (!name) throw new Error('View name is required');
    if (!origin && !registry) throw new Error('Origin or registry is required');

    this.name = name;
    this.origin = origin || encodeOrigin(registry);
    this.registry = registry || null;
    this.type = type;
    this.select = select;
    this.createdAt = new Date().toISOString();
  }

  /**
   * Get the cache key prefix for this view's origin and type
   */
  getCacheKeyPrefix() {
    return `v1:${this.type}:${this.origin}:`;
  }

  toJSON() {
    return {
      name: this.name,
      origin: this.origin,
      registry: this.registry,
      type: this.type,
      select: this.select,
      createdAt: this.createdAt
    };
  }

  static fromJSON(data) {
    const view = new View({
      name: data.name,
      origin: data.origin,
      type: data.type,
      select: data.select
    });
    view.registry = data.registry;
    view.createdAt = data.createdAt;
    return view;
  }

  toString() {
    return `View(${this.name}: ${this.origin}/${this.type})`;
  }
}
