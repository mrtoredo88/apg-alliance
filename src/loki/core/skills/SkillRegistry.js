import { PartnerSearchSkill } from './skills/PartnerSearchSkill.js';
import { ExpertSearchSkill } from './skills/ExpertSearchSkill.js';
import { BookingSkill } from './skills/BookingSkill.js';
import { PromotionSkill } from './skills/PromotionSkill.js';
import { EventSkill } from './skills/EventSkill.js';
import { GiftSkill } from './skills/GiftSkill.js';
import { RewardsSkill } from './skills/RewardsSkill.js';
import { KeysSkill } from './skills/KeysSkill.js';
import { ProfileSkill } from './skills/ProfileSkill.js';
import { DialogSkill } from './skills/DialogSkill.js';
import { WorkspaceSkill } from './skills/WorkspaceSkill.js';
import { NewsSkill } from './skills/NewsSkill.js';

const SKILLS = [
  BookingSkill,
  PartnerSearchSkill,
  ExpertSearchSkill,
  PromotionSkill,
  EventSkill,
  GiftSkill,
  RewardsSkill,
  KeysSkill,
  ProfileSkill,
  DialogSkill,
  WorkspaceSkill,
  NewsSkill,
].sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id));

const BY_ID = new Map(SKILLS.map(skill => [skill.id, skill]));

export function getSkillRegistry() {
  return SKILLS.slice();
}

export function getSkillById(id = '') {
  return BY_ID.get(id) || null;
}

export class SkillRegistry {
  all() {
    return getSkillRegistry();
  }

  get(id = '') {
    return getSkillById(id);
  }
}
