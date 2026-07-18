export function buildKnowledgeSnapshot(index = {}, validation = {}) {
  const counts = index.counts || {};
  return {
    snapshotId: `knowledge-index-${Date.now()}`,
    Partners: counts.partner || 0,
    Experts: counts.expert || 0,
    Locations: counts.location || 0,
    Events: counts.event || 0,
    Promotions: counts.promotion || 0,
    News: counts.news || 0,
    Dialogs: counts.dialog || 0,
    Bookings: counts.booking || 0,
    Workspace: counts.workspace || 0,
    Rewards: counts.reward || 0,
    Keys: counts.key || 0,
    Gifts: counts.gift || 0,
    FAQ: counts.faq || 0,
    Categories: counts.category || 0,
    Tags: counts.tag || 0,
    Relations: index.relations?.length || 0,
    Indexed: validation.valid === false ? 'WARN' : 'OK',
    LastUpdate: index.updatedAt || index.generatedAt || new Date().toISOString(),
    Entities: index.entities?.length || 0,
  };
}
