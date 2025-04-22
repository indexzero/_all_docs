import { XDG } from '@vltpkg/xdg'

export default class Config {
  constructor(cli) {
    this.cli = cli;
    this.xdg = new XDG('_all_docs')

    this.dirs = {
      partitions: this.xdg.cache('partitions'),
      packuments: this.xdg.cache('packuments'),
      logs: this.xdg.data('logs'),
      sessions: this.xdg.data('sessions')
    }
  }

  get(key) {
    return this.cli.values[key];
  }

  dir(which) {
    if (this.dirs[which]) {
      return this.dirs[which];
    }
  }

  usage() {
    return this.cli.usage();
  }

  get values() {
    return this.cli.values;
  }

  get _() {
    return this.cli._;
  }
}
