export const GIFT_SHIMMER_STYLE = {
  borderColor: 'rgba(232,201,122,0.58)',
  background: 'linear-gradient(115deg, rgba(201,168,76,0.18) 0%, rgba(255,246,210,0.48) 22%, rgba(201,168,76,0.22) 44%, rgba(255,255,255,0.16) 62%, rgba(232,201,122,0.34) 82%, rgba(201,168,76,0.18) 100%)',
  backgroundSize: '280% 100%',
  animation: 'shimmer 3.4s ease-in-out infinite',
  boxShadow: '0 12px 30px rgba(201,168,76,0.18), inset 0 1px 0 rgba(255,255,255,0.32)',
};

export function isGiftAction(action = {}) {
  return action.id === 'rewards' || action.label === 'Подарки' || action.label === 'Открыть подарки';
}
