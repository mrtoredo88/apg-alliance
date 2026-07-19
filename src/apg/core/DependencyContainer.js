export class DependencyContainer {
  constructor(initial = {}) {
    this.registry = new Map(Object.entries(initial));
  }

  register(key, value) {
    if (!key) throw new Error('dependency_key_required');
    this.registry.set(String(key), value);
    return value;
  }

  resolve(key) {
    if (!this.registry.has(String(key))) throw new Error(`dependency_not_registered:${key}`);
    const value = this.registry.get(String(key));
    return typeof value === 'function' && value.__apgFactory === true ? value(this) : value;
  }

  optional(key, fallback = null) {
    return this.registry.has(String(key)) ? this.resolve(key) : fallback;
  }

  has(key) {
    return this.registry.has(String(key));
  }
}

export function dependencyFactory(fn) {
  fn.__apgFactory = true;
  return fn;
}
