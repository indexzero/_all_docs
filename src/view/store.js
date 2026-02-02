/**
 * ViewStore - file-based storage for view definitions
 */
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { View } from './view.js';

export class ViewStore {
  constructor(baseDir) {
    this.viewsDir = join(baseDir, 'views');
  }

  async init() {
    await mkdir(this.viewsDir, { recursive: true });
  }

  viewPath(name) {
    // Sanitize name to prevent directory traversal
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    return join(this.viewsDir, `${safeName}.view.json`);
  }

  async save(view) {
    await this.init();
    const json = JSON.stringify(view.toJSON(), null, 2);
    await writeFile(this.viewPath(view.name), json, 'utf8');
  }

  async load(name) {
    try {
      const data = await readFile(this.viewPath(name), 'utf8');
      return View.fromJSON(JSON.parse(data));
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`View '${name}' not found. Run '_all_docs view list' to see available views.`);
      }
      throw err;
    }
  }

  async list() {
    try {
      await this.init();
      const files = await readdir(this.viewsDir);
      return files
        .filter(f => f.endsWith('.view.json'))
        .map(f => f.replace('.view.json', ''));
    } catch (err) {
      if (err.code === 'ENOENT') {
        return [];
      }
      throw err;
    }
  }

  async delete(name) {
    try {
      await unlink(this.viewPath(name));
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`View '${name}' not found.`);
      }
      throw err;
    }
  }

  async exists(name) {
    try {
      await readFile(this.viewPath(name), 'utf8');
      return true;
    } catch {
      return false;
    }
  }
}
