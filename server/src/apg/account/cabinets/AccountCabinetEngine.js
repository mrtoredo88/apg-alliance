export function summarizeCabinets(cabinets = []) {
  return {
    total: cabinets.length,
    partner: cabinets.filter(item => item.type === 'partner').length,
    expert: cabinets.filter(item => item.type === 'expert').length,
    admin: cabinets.filter(item => item.type === 'admin').length,
  };
}
