// Every image below was exported from the Figma file "29 Oct Farm Management App"
// (fileKey dvRxEJtTy8rGBPIVmCLb4E) and lives in /public/assets.

const BASE: string = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './';

export const asset = (file: string) => `${BASE}assets/${file}`;

export const img = {
  // farm scene + HUD
  bg: asset('bg-farm.webp'),
  avatar: asset('avatar.png'),
  star: asset('star.png'),
  coin: asset('coin.png'),
  coin20: asset('coin-20.png'),
  coinBig: asset('coin-big.png'),
  drop: asset('drop.png'),
  sack: asset('sack.png'),
  cart: asset('cart.png'),
  infoBtn: asset('info-btn.png'),
  sprout: asset('sprout.png'),
  milk: asset('milk.png'),
  egg: asset('egg.png'),
  plank: asset('title-plank.png'),
  plotHighlight: asset('plot-highlight.webp'),
  arrows: [asset('arrow-1.png'), asset('arrow-2.png'), asset('arrow-3.png'), asset('arrow-4.png')],
  farmInfo: asset('fa-info.png'),
  farmFarm: asset('fa-farm.png'),
  farmUpgrade: asset('fa-upgrade.png'),
  farmHarvest: asset('fa-harvest.png'),

  // modal chrome
  modalShop: asset('modal-shop.webp'),
  modalWide: asset('modal-wide.webp'),
  modalTall: asset('modal-tall.webp'),
  close: asset('close.png'),
  bubble: asset('bubble.png'),
  tipBubble: asset('tip-bubble.webp'),
  shopkeeper: asset('shopkeeper.webp'),
  guide: asset('guide.webp'),
  partner: asset('partner.png'),
  cash: asset('cash.png'),
  idea: asset('idea.png'),

  // produce + misc
  corn: asset('corn.webp'),
  cornPreview: asset('corn-preview.webp'),
  maizeMini: asset('maize-mini.png'),
  timingMaize: asset('timing-maize.png'),
  yieldIcon: asset('yield.png'),
  aiBot: asset('ai-bot.png'),
  farmPhoto: asset('farm-photo.webp'),
  clock: asset('clock.png'),
  coupon: asset('coupon.png'),
  rewardAvatar: asset('reward-avatar.png'),
  waterInput: asset('water-input.png'),
} as const;

export type ImageKey = keyof typeof img;
