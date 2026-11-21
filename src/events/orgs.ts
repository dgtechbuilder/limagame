/* The Donate page: real organisations working on hunger and climate in Africa. The game takes no money: each card
   links to the organisation's own official site, where real gifts are made. The links are their home pages (each has
   its Donate button there), which stay put when a charity moves its donate page. */

export type OrgFocus = 'food' | 'farmers' | 'children' | 'emergency' | 'cash';

export const ORG_FOCUS: Record<OrgFocus, string> = {
  food: 'Food aid',
  farmers: 'Farmers',
  children: 'Children',
  emergency: 'Emergencies',
  cash: 'Cash transfers',
};

export interface Org {
  id: string;
  name: string;
  /** short name for the badge */
  short: string;
  focus: OrgFocus;
  /** the colour of its badge */
  color: string;
  /** what it does, in a sentence */
  line: string;
  /** where a gift goes, in a sentence */
  gift: string;
  /** its official site */
  url: string;
}

export const ORGS: Org[] = [
  {
    id: 'wfp',
    name: 'World Food Programme',
    short: 'WFP',
    focus: 'food',
    color: '#1a73b8',
    line: 'The United Nations’ food agency: food in emergencies, school meals, and help for communities to withstand drought and floods.',
    gift: 'Food rations, school meals and cash for food where harvests fail.',
    url: 'https://www.wfp.org/',
  },
  {
    id: 'oneacre',
    name: 'One Acre Fund',
    short: '1AF',
    focus: 'farmers',
    color: '#4d8b31',
    line: 'Works with smallholder farmers across East Africa: seed and fertilizer on credit, training, and tree planting.',
    gift: 'Farm inputs and training that help a family grow more on its own land.',
    url: 'https://oneacrefund.org/',
  },
  {
    id: 'unicef',
    name: 'UNICEF',
    short: 'UNICEF',
    focus: 'children',
    color: '#1cabe2',
    line: 'The United Nations’ children’s agency: nutrition, clean water, health and schooling for children in crises.',
    gift: 'Treatment for malnourished children, clean water and vaccines.',
    url: 'https://www.unicef.org/',
  },
  {
    id: 'aah',
    name: 'Action Against Hunger',
    short: 'AAH',
    focus: 'food',
    color: '#e1261c',
    line: 'Treats and prevents malnutrition, and helps families find water and a living after a drought or a conflict.',
    gift: 'Nutrition care for children and water for communities.',
    url: 'https://www.actionagainsthunger.org/',
  },
  {
    id: 'heifer',
    name: 'Heifer International',
    short: 'Heifer',
    focus: 'farmers',
    color: '#d1662b',
    line: 'Helps farming families earn a living from animals and crops, with training and links to markets.',
    gift: 'Animals, training and farmer groups that build an income.',
    url: 'https://www.heifer.org/',
  },
  {
    id: 'ifrc',
    name: 'Red Cross & Red Crescent (IFRC)',
    short: 'IFRC',
    focus: 'emergency',
    color: '#c8102e',
    line: 'The world’s largest humanitarian network, with a national society in every African country (the Kenya Red Cross among them).',
    gift: 'Relief after floods, droughts and cyclones, and early warning before them.',
    url: 'https://www.ifrc.org/',
  },
  {
    id: 'oxfam',
    name: 'Oxfam',
    short: 'Oxfam',
    focus: 'emergency',
    color: '#61a534',
    line: 'Fights poverty and inequality: water and sanitation in emergencies, and support for small farmers and women.',
    gift: 'Clean water, food and help for families to recover.',
    url: 'https://www.oxfam.org/',
  },
  {
    id: 'givedirectly',
    name: 'GiveDirectly',
    short: 'GD',
    focus: 'cash',
    color: '#2b5f8e',
    line: 'Sends money straight to families living in poverty, by mobile money, for them to spend as they choose.',
    gift: 'Cash to a family’s phone, often spent on food, a farm or a business.',
    url: 'https://www.givedirectly.org/',
  },
];

export const orgOf = (id: string) => ORGS.find(o => o.id === id);
