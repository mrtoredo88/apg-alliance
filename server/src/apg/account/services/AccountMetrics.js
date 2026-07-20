export class AccountMetrics {
  constructor() {
    this.counters = {
      accountReads: 0,
      accountWrites: 0,
      fallbackCount: 0,
      roleResolution: 0,
      workspaceBootstrap: 0,
      profileBootstrap: 0,
      homeBootstrap: 0,
      sessionRestore: 0,
      ownerResolution: 0,
    };
    this.latency = {
      postgres: [],
      firestoreFallback: [],
    };
    this.lastError = null;
  }

  increment(key) {
    this.counters[key] = Number(this.counters[key] || 0) + 1;
  }

  recordLatency(key, value) {
    const list = this.latency[key] || [];
    list.push(Number(value || 0));
    this.latency[key] = list.slice(-50);
  }

  recordError(error) {
    this.lastError = {
      code: error?.code || '',
      message: String(error?.message || error).slice(0, 220),
      at: new Date().toISOString(),
    };
  }

  average(key) {
    const list = this.latency[key] || [];
    if (!list.length) return 0;
    return Math.round(list.reduce((sum, item) => sum + item, 0) / list.length);
  }

  snapshot() {
    return {
      ...this.counters,
      postgresLatencyMs: this.average('postgres'),
      firestoreFallbackLatencyMs: this.average('firestoreFallback'),
      lastError: this.lastError,
    };
  }
}
