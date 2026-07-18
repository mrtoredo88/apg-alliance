function list(value) {
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

export function validateConversationResolution(resolution = {}) {
  if (!resolution || resolution.status === 'none') return { ok: true, reason: 'no_reference' };
  if (resolution.status === 'resolved' && resolution.entity?.id) return { ok: true, reason: resolution.reason || 'resolved' };
  if (resolution.status === 'ambiguous') {
    const candidates = list(resolution.candidates).slice(0, 3);
    return {
      ok: false,
      reason: 'ambiguous_reference',
      text: candidates.length
        ? `Уточните, пожалуйста: вы имеете в виду ${candidates.map(item => `«${item.title}»`).join(' или ')}?`
        : 'Уточните, пожалуйста, к какому варианту относится вопрос.',
    };
  }
  return {
    ok: false,
    reason: resolution.reason || 'reference_not_found',
    text: 'Я не смог надёжно понять, к какому варианту относится вопрос. Напишите название или номер варианта.',
  };
}
