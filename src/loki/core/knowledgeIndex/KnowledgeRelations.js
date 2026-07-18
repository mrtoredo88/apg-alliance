import { entityKey, toList } from './KnowledgeEntity.js';

function addRelation(relations, fromType, fromId, toType, toId, relation) {
  if (!fromId || !toId) return;
  relations.push({
    id: `${fromType}:${fromId}->${relation}->${toType}:${toId}`,
    from: entityKey(fromType, fromId),
    to: entityKey(toType, toId),
    fromType,
    fromId: String(fromId),
    toType,
    toId: String(toId),
    relation,
  });
}

function sourceIds(item = {}, keys = []) {
  return keys.flatMap(key => toList(item[key])).map(String).filter(Boolean);
}

export function buildKnowledgeRelations({ sources = {}, entities = [] } = {}) {
  const relations = [];
  const partnerIds = new Set(toList(sources.partners).map(item => String(item.id)));
  const expertIds = new Set(toList(sources.experts).map(item => String(item.id)));
  const eventIds = new Set(toList(sources.events).map(item => String(item.id)));
  const newsIds = new Set(toList(sources.news || sources.articles).map(item => String(item.id)));

  toList(sources.locations).forEach(location => addRelation(relations, 'partner', location.partnerId, 'location', location.id, 'has_location'));

  toList(sources.promotions).forEach(promotion => {
    addRelation(relations, 'partner', promotion.partnerId || promotion.profileId, 'promotion', promotion.id, 'has_promotion');
    sourceIds(promotion, ['partnerIds']).forEach(id => addRelation(relations, 'partner', id, 'promotion', promotion.id, 'has_promotion'));
    sourceIds(promotion, ['locationIds']).forEach(id => addRelation(relations, 'promotion', promotion.id, 'location', id, 'available_at'));
  });

  toList(sources.events).forEach(event => {
    sourceIds(event, ['partnerIds', 'partners']).forEach(id => partnerIds.has(id) && addRelation(relations, 'partner', id, 'event', event.id, 'hosts_event'));
    sourceIds(event, ['expertIds', 'experts']).forEach(id => expertIds.has(id) && addRelation(relations, 'expert', id, 'event', event.id, 'speaks_at'));
    if (event.partnerId) addRelation(relations, 'partner', event.partnerId, 'event', event.id, 'hosts_event');
    if (event.expertId) addRelation(relations, 'expert', event.expertId, 'event', event.id, 'speaks_at');
  });

  toList(sources.experts).forEach(expert => {
    sourceIds(expert, ['partnerIds', 'linkedPartnerIds']).forEach(id => addRelation(relations, 'expert', expert.id, 'partner', id, 'works_with'));
    sourceIds(expert, ['locationIds']).forEach(id => addRelation(relations, 'expert', expert.id, 'location', id, 'works_at'));
    if (expert.partnerId) addRelation(relations, 'expert', expert.id, 'partner', expert.partnerId, 'works_with');
  });

  toList(sources.bookings || sources.meetings).forEach(booking => {
    addRelation(relations, booking.providerType === 'expert' ? 'expert' : 'partner', booking.providerId || booking.partnerId || booking.expertId, 'booking', booking.id, 'has_booking');
    addRelation(relations, 'expert', booking.specialistId || booking.expertId, 'booking', booking.id, 'assigned_booking');
    addRelation(relations, 'location', booking.locationId, 'booking', booking.id, 'booking_at');
  });

  toList(sources.dialogs).forEach(dialog => {
    const context = dialog.context || {};
    addRelation(relations, context.type || dialog.contextType || 'partner', context.id || dialog.contextId || dialog.partnerId || dialog.expertId || dialog.eventId, 'dialog', dialog.id, 'has_dialog');
  });

  toList(sources.news || sources.articles).forEach(news => {
    sourceIds(news, ['partnerIds']).forEach(id => partnerIds.has(id) && addRelation(relations, 'partner', id, 'news', news.id, 'mentioned_in'));
    sourceIds(news, ['expertIds']).forEach(id => expertIds.has(id) && addRelation(relations, 'expert', id, 'news', news.id, 'mentioned_in'));
    sourceIds(news, ['eventIds']).forEach(id => eventIds.has(id) && addRelation(relations, 'event', id, 'news', news.id, 'covered_by'));
  });

  toList(sources.gifts).forEach(gift => {
    addRelation(relations, 'partner', gift.partnerId || gift.profileId, 'gift', gift.id, 'provides_gift');
  });

  entities.forEach(entity => {
    toList(entity.relations).forEach(row => addRelation(relations, entity.type, entity.id, row.type, row.id, row.relation || 'related_to'));
  });

  const seen = new Set();
  return relations.filter(row => {
    if (!row.fromId || !row.toId || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export function expandKnowledgeRelations(index = {}, entities = [], depth = 1) {
  const entityKeys = new Set(entities.map(item => item.key));
  const expanded = new Set(entityKeys);
  for (let i = 0; i < depth; i += 1) {
    index.relations.forEach(row => {
      if (expanded.has(row.from)) expanded.add(row.to);
      if (expanded.has(row.to)) expanded.add(row.from);
    });
  }
  return [...expanded].map(key => index.entityMap.get(key)).filter(Boolean);
}
