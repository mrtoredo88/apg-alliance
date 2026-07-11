const REQUIRED_HOOKS = ['canHandle', 'handle'];

function assertModule(module) {
  if (!module || typeof module !== 'object') throw new TypeError('Loki module must be an object');
  if (!String(module.id || '').trim()) throw new TypeError('Loki module must have a stable id');
  for (const hook of REQUIRED_HOOKS) {
    if (typeof module[hook] !== 'function') throw new TypeError(`Loki module ${module.id} must implement ${hook}()`);
  }
}

export class LokiModuleRegistry {
  constructor(modules = []) {
    this.modules = new Map();
    modules.forEach(module => this.register(module));
  }

  register(module) {
    assertModule(module);
    if (this.modules.has(module.id)) throw new Error(`Duplicate Loki module: ${module.id}`);
    this.modules.set(module.id, Object.freeze({ priority: 0, roles: ['*'], ...module }));
    return this;
  }

  list(role = 'user') {
    return [...this.modules.values()]
      .filter(module => module.roles.includes('*') || module.roles.includes(role))
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));
  }

  async resolve(input) {
    const role = input.context?.actor?.role || input.context?.profile?.role || 'user';
    for (const module of this.list(role)) {
      if (!await module.canHandle(input)) continue;
      const result = await module.handle(input);
      if (result) return { module, result };
    }
    return { module: null, result: null };
  }
}
