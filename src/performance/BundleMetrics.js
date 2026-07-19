const BUNDLE_CATEGORY_RULES = [
  ['react', /vendor-react|react|react-dom|scheduler/i],
  ['firebase', /vendor-firebase|firebase|firestore|auth/i],
  ['vkui', /vkui|vkontakte/i],
  ['loki', /loki|Loki|ContextEngine|ProactiveEngine|ActionExecutor|DismissManager|Personality|Capability|Evaluation|Execution|Knowledge|ToolRegistry|ToolResult/i],
  ['workspace', /Workspace|workspace|CabinetCore/i],
  ['markdown', /Markdown|MdEditor|remark|react-markdown/i],
  ['qr', /qr|Scanner|QRCode/i],
  ['aws', /aws|s3|presigner/i],
];

function classifyBundleResource(name = '') {
  const match = BUNDLE_CATEGORY_RULES.find(([, pattern]) => pattern.test(name));
  return match?.[0] || 'other';
}

function bytes(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? Math.max(0, Math.round(num)) : 0;
}

function kb(value) {
  return Math.round((bytes(value) / 1024) * 10) / 10;
}

export function collectBundleMetrics() {
  if (typeof performance === 'undefined' || typeof window === 'undefined') {
    return { supported: false, chunks: [], totals: {}, categories: {} };
  }
  const resources = typeof performance.getEntriesByType === 'function'
    ? performance.getEntriesByType('resource')
    : [];
  const chunks = resources
    .filter(item => /\/assets\/.+\.(js|css)$/i.test(item.name || ''))
    .map(item => {
      const url = item.name || '';
      const name = url.split('/').pop() || url;
      return {
        name,
        category: classifyBundleResource(name),
        type: /\.css$/i.test(name) ? 'css' : 'js',
        transferKb: kb(item.transferSize),
        encodedKb: kb(item.encodedBodySize),
        decodedKb: kb(item.decodedBodySize),
        durationMs: Math.round(item.duration || 0),
      };
    });
  const categories = chunks.reduce((acc, chunk) => {
    const row = acc[chunk.category] || { chunks: 0, transferKb: 0, encodedKb: 0, decodedKb: 0 };
    row.chunks += 1;
    row.transferKb = Math.round((row.transferKb + chunk.transferKb) * 10) / 10;
    row.encodedKb = Math.round((row.encodedKb + chunk.encodedKb) * 10) / 10;
    row.decodedKb = Math.round((row.decodedKb + chunk.decodedKb) * 10) / 10;
    acc[chunk.category] = row;
    return acc;
  }, {});
  const totals = chunks.reduce((acc, chunk) => ({
    chunks: acc.chunks + 1,
    transferKb: Math.round((acc.transferKb + chunk.transferKb) * 10) / 10,
    encodedKb: Math.round((acc.encodedKb + chunk.encodedKb) * 10) / 10,
    decodedKb: Math.round((acc.decodedKb + chunk.decodedKb) * 10) / 10,
  }), { chunks: 0, transferKb: 0, encodedKb: 0, decodedKb: 0 });
  return {
    supported: true,
    collectedAt: new Date().toISOString(),
    initialHint: chunks.filter(item => ['vendor-react', 'vendor-firebase', 'index-', 'UserApp-'].some(prefix => item.name.startsWith(prefix))).length,
    totals,
    categories,
    chunks: chunks.sort((a, b) => b.decodedKb - a.decodedKb).slice(0, 24),
  };
}
