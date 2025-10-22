export interface CockTemplate {
  templateId: string;
  image: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  baseStats: {
    attack: number;
    defence: number;
    stamina: number;
    speed: number;
  };
}

export const COCK_TEMPLATES: CockTemplate[] = [
  // Legendary Cocks (40-45 per stat)
  { templateId: "cock_legendary_001", image: "/assets/Cocks/Legendary/Cock 1.jpg", rarity: "legendary", baseStats: { attack: 44, defence: 43, stamina: 45, speed: 42 } },
  { templateId: "cock_legendary_002", image: "/assets/Cocks/Legendary/Cock 2.jpg", rarity: "legendary", baseStats: { attack: 45, defence: 42, stamina: 43, speed: 44 } },
  { templateId: "cock_legendary_003", image: "/assets/Cocks/Legendary/Cock 3.jpg", rarity: "legendary", baseStats: { attack: 43, defence: 45, stamina: 44, speed: 43 } },
  { templateId: "cock_legendary_004", image: "/assets/Cocks/Legendary/Cock 4.jpg", rarity: "legendary", baseStats: { attack: 42, defence: 44, stamina: 42, speed: 45 } },
  { templateId: "cock_legendary_005", image: "/assets/Cocks/Legendary/Cock 5.jpg", rarity: "legendary", baseStats: { attack: 45, defence: 43, stamina: 44, speed: 42 } },
  { templateId: "cock_legendary_006", image: "/assets/Cocks/Legendary/Cock 6.jpg", rarity: "legendary", baseStats: { attack: 44, defence: 45, stamina: 42, speed: 43 } },
  { templateId: "cock_legendary_007", image: "/assets/Cocks/Legendary/Cock 7.jpg", rarity: "legendary", baseStats: { attack: 43, defence: 42, stamina: 45, speed: 44 } },
  { templateId: "cock_legendary_008", image: "/assets/Cocks/Legendary/Cock 8.jpg", rarity: "legendary", baseStats: { attack: 42, defence: 43, stamina: 43, speed: 45 } },
  { templateId: "cock_legendary_009", image: "/assets/Cocks/Legendary/Cock 9.png", rarity: "legendary", baseStats: { attack: 45, defence: 44, stamina: 43, speed: 43 } },

  // Epic Cocks (35-40 per stat)
  { templateId: "cock_epic_001", image: "/assets/Cocks/Epic/Cock 1.png", rarity: "epic", baseStats: { attack: 39, defence: 38, stamina: 40, speed: 37 } },
  { templateId: "cock_epic_002", image: "/assets/Cocks/Epic/Cock 2.png", rarity: "epic", baseStats: { attack: 40, defence: 37, stamina: 38, speed: 39 } },
  { templateId: "cock_epic_003", image: "/assets/Cocks/Epic/Cock 3.png", rarity: "epic", baseStats: { attack: 38, defence: 40, stamina: 39, speed: 38 } },
  { templateId: "cock_epic_004", image: "/assets/Cocks/Epic/Cock 4.jpg", rarity: "epic", baseStats: { attack: 37, defence: 39, stamina: 37, speed: 40 } },
  { templateId: "cock_epic_005", image: "/assets/Cocks/Epic/Cock 5.jpg", rarity: "epic", baseStats: { attack: 40, defence: 38, stamina: 39, speed: 37 } },
  { templateId: "cock_epic_006", image: "/assets/Cocks/Epic/Cock 6.png", rarity: "epic", baseStats: { attack: 39, defence: 40, stamina: 37, speed: 38 } },
  { templateId: "cock_epic_007", image: "/assets/Cocks/Epic/Cock 7.jpg", rarity: "epic", baseStats: { attack: 38, defence: 37, stamina: 40, speed: 39 } },
  { templateId: "cock_epic_008", image: "/assets/Cocks/Epic/Cock 8.jpg", rarity: "epic", baseStats: { attack: 37, defence: 38, stamina: 38, speed: 40 } },
  { templateId: "cock_epic_009", image: "/assets/Cocks/Epic/Cock 9.jpg", rarity: "epic", baseStats: { attack: 40, defence: 39, stamina: 38, speed: 38 } },
  { templateId: "cock_epic_010", image: "/assets/Cocks/Epic/Cock 10.jpg", rarity: "epic", baseStats: { attack: 39, defence: 37, stamina: 40, speed: 39 } },
  { templateId: "cock_epic_011", image: "/assets/Cocks/Epic/Cock 11.jpg", rarity: "epic", baseStats: { attack: 38, defence: 39, stamina: 39, speed: 40 } },

  // Rare Cocks (30-35 per stat)
  { templateId: "cock_rare_001", image: "/assets/Cocks/Rare/Cock 1.png", rarity: "rare", baseStats: { attack: 34, defence: 33, stamina: 35, speed: 32 } },
  { templateId: "cock_rare_002", image: "/assets/Cocks/Rare/Cock 2.jpg", rarity: "rare", baseStats: { attack: 35, defence: 32, stamina: 33, speed: 34 } },
  { templateId: "cock_rare_003", image: "/assets/Cocks/Rare/Cock 3.png", rarity: "rare", baseStats: { attack: 33, defence: 35, stamina: 34, speed: 33 } },
  { templateId: "cock_rare_004", image: "/assets/Cocks/Rare/Cock 4.jpg", rarity: "rare", baseStats: { attack: 32, defence: 34, stamina: 32, speed: 35 } },
  { templateId: "cock_rare_005", image: "/assets/Cocks/Rare/Cock 5.png", rarity: "rare", baseStats: { attack: 35, defence: 33, stamina: 34, speed: 32 } },
  { templateId: "cock_rare_006", image: "/assets/Cocks/Rare/Cock 6.jpg", rarity: "rare", baseStats: { attack: 34, defence: 35, stamina: 32, speed: 33 } },
  { templateId: "cock_rare_007", image: "/assets/Cocks/Rare/Cock 7.jpg", rarity: "rare", baseStats: { attack: 33, defence: 32, stamina: 35, speed: 34 } },
  { templateId: "cock_rare_008", image: "/assets/Cocks/Rare/Cock 8.jpg", rarity: "rare", baseStats: { attack: 32, defence: 33, stamina: 33, speed: 35 } },
  { templateId: "cock_rare_009", image: "/assets/Cocks/Rare/Cock 9.jpg", rarity: "rare", baseStats: { attack: 35, defence: 34, stamina: 33, speed: 33 } },
  { templateId: "cock_rare_010", image: "/assets/Cocks/Rare/Cock 10.jpg", rarity: "rare", baseStats: { attack: 34, defence: 32, stamina: 35, speed: 34 } },
  { templateId: "cock_rare_011", image: "/assets/Cocks/Rare/Cock 11.png", rarity: "rare", baseStats: { attack: 33, defence: 34, stamina: 34, speed: 35 } },
  { templateId: "cock_rare_012", image: "/assets/Cocks/Rare/Cock 12.jpg", rarity: "rare", baseStats: { attack: 32, defence: 35, stamina: 32, speed: 34 } },
  { templateId: "cock_rare_013", image: "/assets/Cocks/Rare/Cock 13.jpg", rarity: "rare", baseStats: { attack: 35, defence: 33, stamina: 34, speed: 32 } },
  { templateId: "cock_rare_014", image: "/assets/Cocks/Rare/Cock 14.jpg", rarity: "rare", baseStats: { attack: 34, defence: 32, stamina: 33, speed: 35 } },
  { templateId: "cock_rare_015", image: "/assets/Cocks/Rare/Cock 15.jpg", rarity: "rare", baseStats: { attack: 33, defence: 35, stamina: 35, speed: 32 } },
  { templateId: "cock_rare_016", image: "/assets/Cocks/Rare/Cock 16.jpg", rarity: "rare", baseStats: { attack: 32, defence: 34, stamina: 32, speed: 33 } },
  { templateId: "cock_rare_017", image: "/assets/Cocks/Rare/Cock 17.png", rarity: "rare", baseStats: { attack: 35, defence: 32, stamina: 34, speed: 34 } },
  { templateId: "cock_rare_018", image: "/assets/Cocks/Rare/Cock 18.jpg", rarity: "rare", baseStats: { attack: 34, defence: 33, stamina: 32, speed: 35 } },
  { templateId: "cock_rare_019", image: "/assets/Cocks/Rare/Cock 19.jpg", rarity: "rare", baseStats: { attack: 33, defence: 35, stamina: 33, speed: 34 } },

  // Uncommon Cocks (25-30 per stat)
  { templateId: "cock_uncommon_001", image: "/assets/Cocks/Uncommon/Cock 1.png", rarity: "uncommon", baseStats: { attack: 29, defence: 28, stamina: 30, speed: 27 } },
  { templateId: "cock_uncommon_002", image: "/assets/Cocks/Uncommon/Cock 2.png", rarity: "uncommon", baseStats: { attack: 30, defence: 27, stamina: 28, speed: 29 } },
  { templateId: "cock_uncommon_003", image: "/assets/Cocks/Uncommon/Cock 3.jpg", rarity: "uncommon", baseStats: { attack: 28, defence: 30, stamina: 29, speed: 28 } },
  { templateId: "cock_uncommon_004", image: "/assets/Cocks/Uncommon/Cock 4.jpg", rarity: "uncommon", baseStats: { attack: 27, defence: 29, stamina: 27, speed: 30 } },
  { templateId: "cock_uncommon_005", image: "/assets/Cocks/Uncommon/Cock 5.png", rarity: "uncommon", baseStats: { attack: 30, defence: 28, stamina: 29, speed: 27 } },
  { templateId: "cock_uncommon_006", image: "/assets/Cocks/Uncommon/Cock 6.jpg", rarity: "uncommon", baseStats: { attack: 29, defence: 30, stamina: 27, speed: 28 } },
  { templateId: "cock_uncommon_007", image: "/assets/Cocks/Uncommon/Cock 7.jpg", rarity: "uncommon", baseStats: { attack: 28, defence: 27, stamina: 30, speed: 29 } },
  { templateId: "cock_uncommon_008", image: "/assets/Cocks/Uncommon/Cock 8.jpg", rarity: "uncommon", baseStats: { attack: 27, defence: 28, stamina: 28, speed: 30 } },
  { templateId: "cock_uncommon_009", image: "/assets/Cocks/Uncommon/Cock 9.jpg", rarity: "uncommon", baseStats: { attack: 30, defence: 29, stamina: 28, speed: 28 } },
  { templateId: "cock_uncommon_010", image: "/assets/Cocks/Uncommon/Cock 10.jpg", rarity: "uncommon", baseStats: { attack: 29, defence: 27, stamina: 30, speed: 29 } },
  { templateId: "cock_uncommon_011", image: "/assets/Cocks/Uncommon/Cock 11.jpg", rarity: "uncommon", baseStats: { attack: 28, defence: 29, stamina: 29, speed: 30 } },
  { templateId: "cock_uncommon_012", image: "/assets/Cocks/Uncommon/Cock 12.png", rarity: "uncommon", baseStats: { attack: 27, defence: 30, stamina: 27, speed: 29 } },
  { templateId: "cock_uncommon_013", image: "/assets/Cocks/Uncommon/Cock 13.jpg", rarity: "uncommon", baseStats: { attack: 30, defence: 28, stamina: 29, speed: 27 } },
  { templateId: "cock_uncommon_014", image: "/assets/Cocks/Uncommon/Cock 14.jpg", rarity: "uncommon", baseStats: { attack: 29, defence: 27, stamina: 28, speed: 30 } },
  { templateId: "cock_uncommon_015", image: "/assets/Cocks/Uncommon/Cock 15.png", rarity: "uncommon", baseStats: { attack: 28, defence: 30, stamina: 30, speed: 27 } },
  { templateId: "cock_uncommon_016", image: "/assets/Cocks/Uncommon/Cock 16.png", rarity: "uncommon", baseStats: { attack: 27, defence: 29, stamina: 27, speed: 28 } },
  { templateId: "cock_uncommon_017", image: "/assets/Cocks/Uncommon/Cock 17.jpg", rarity: "uncommon", baseStats: { attack: 30, defence: 27, stamina: 29, speed: 29 } },
  { templateId: "cock_uncommon_018", image: "/assets/Cocks/Uncommon/Cock 18.jpg", rarity: "uncommon", baseStats: { attack: 29, defence: 28, stamina: 27, speed: 30 } },
  { templateId: "cock_uncommon_019", image: "/assets/Cocks/Uncommon/Cock 19.jpg", rarity: "uncommon", baseStats: { attack: 28, defence: 30, stamina: 28, speed: 29 } },
  { templateId: "cock_uncommon_020", image: "/assets/Cocks/Uncommon/Cock 20.png", rarity: "uncommon", baseStats: { attack: 27, defence: 28, stamina: 30, speed: 28 } },
  { templateId: "cock_uncommon_021", image: "/assets/Cocks/Uncommon/Cock 21.jpg", rarity: "uncommon", baseStats: { attack: 30, defence: 29, stamina: 27, speed: 29 } },
  { templateId: "cock_uncommon_022", image: "/assets/Cocks/Uncommon/Cock 22.jpg", rarity: "uncommon", baseStats: { attack: 29, defence: 27, stamina: 29, speed: 30 } },

  // Common Cocks (20-25 per stat)
  { templateId: "cock_common_001", image: "/assets/Cocks/Common/Cock 1.jpg", rarity: "common", baseStats: { attack: 24, defence: 23, stamina: 25, speed: 22 } },
  { templateId: "cock_common_002", image: "/assets/Cocks/Common/Cock 2.png", rarity: "common", baseStats: { attack: 25, defence: 22, stamina: 23, speed: 24 } },
  { templateId: "cock_common_003", image: "/assets/Cocks/Common/Cock 3.png", rarity: "common", baseStats: { attack: 23, defence: 25, stamina: 24, speed: 23 } },
  { templateId: "cock_common_004", image: "/assets/Cocks/Common/Cock 4.png", rarity: "common", baseStats: { attack: 22, defence: 24, stamina: 22, speed: 25 } },
  { templateId: "cock_common_005", image: "/assets/Cocks/Common/Cock 5.png", rarity: "common", baseStats: { attack: 25, defence: 23, stamina: 24, speed: 22 } },
  { templateId: "cock_common_006", image: "/assets/Cocks/Common/Cock 6.png", rarity: "common", baseStats: { attack: 24, defence: 25, stamina: 22, speed: 23 } },
  { templateId: "cock_common_007", image: "/assets/Cocks/Common/Cock 7.jpg", rarity: "common", baseStats: { attack: 23, defence: 22, stamina: 25, speed: 24 } },
  { templateId: "cock_common_008", image: "/assets/Cocks/Common/Cock 8.jpg", rarity: "common", baseStats: { attack: 22, defence: 23, stamina: 23, speed: 25 } },
  { templateId: "cock_common_009", image: "/assets/Cocks/Common/Cock 9.jpg", rarity: "common", baseStats: { attack: 25, defence: 24, stamina: 23, speed: 23 } },
  { templateId: "cock_common_010", image: "/assets/Cocks/Common/Cock 10.jpg", rarity: "common", baseStats: { attack: 24, defence: 22, stamina: 25, speed: 24 } },
  { templateId: "cock_common_011", image: "/assets/Cocks/Common/Cock 11.png", rarity: "common", baseStats: { attack: 23, defence: 24, stamina: 24, speed: 25 } },
  { templateId: "cock_common_012", image: "/assets/Cocks/Common/Cock 12.jpg", rarity: "common", baseStats: { attack: 22, defence: 25, stamina: 22, speed: 24 } },
  { templateId: "cock_common_013", image: "/assets/Cocks/Common/Cock 13.jpg", rarity: "common", baseStats: { attack: 25, defence: 23, stamina: 24, speed: 22 } },
  { templateId: "cock_common_014", image: "/assets/Cocks/Common/Cock 14.jpg", rarity: "common", baseStats: { attack: 24, defence: 22, stamina: 23, speed: 25 } },
  { templateId: "cock_common_015", image: "/assets/Cocks/Common/Cock 15.jpg", rarity: "common", baseStats: { attack: 23, defence: 25, stamina: 25, speed: 22 } },
  { templateId: "cock_common_016", image: "/assets/Cocks/Common/Cock 16.jpg", rarity: "common", baseStats: { attack: 22, defence: 24, stamina: 22, speed: 23 } },
  { templateId: "cock_common_017", image: "/assets/Cocks/Common/Cock 17.jpg", rarity: "common", baseStats: { attack: 25, defence: 22, stamina: 24, speed: 24 } },
  { templateId: "cock_common_018", image: "/assets/Cocks/Common/Cock 18.jpg", rarity: "common", baseStats: { attack: 24, defence: 23, stamina: 22, speed: 25 } },
  { templateId: "cock_common_019", image: "/assets/Cocks/Common/Cock 19.jpg", rarity: "common", baseStats: { attack: 23, defence: 25, stamina: 23, speed: 24 } },
  { templateId: "cock_common_020", image: "/assets/Cocks/Common/Cock 20.jpg", rarity: "common", baseStats: { attack: 22, defence: 23, stamina: 25, speed: 23 } },
  { templateId: "cock_common_021", image: "/assets/Cocks/Common/Cock 21.jpg", rarity: "common", baseStats: { attack: 25, defence: 24, stamina: 22, speed: 24 } },
  { templateId: "cock_common_022", image: "/assets/Cocks/Common/Cock 22.jpg", rarity: "common", baseStats: { attack: 24, defence: 22, stamina: 24, speed: 25 } },
  { templateId: "cock_common_023", image: "/assets/Cocks/Common/Cock 23.jpg", rarity: "common", baseStats: { attack: 23, defence: 24, stamina: 23, speed: 22 } },
  { templateId: "cock_common_024", image: "/assets/Cocks/Common/Cock 24.jpg", rarity: "common", baseStats: { attack: 22, defence: 25, stamina: 24, speed: 23 } },
  { templateId: "cock_common_025", image: "/assets/Cocks/Common/Cock 25.jpg", rarity: "common", baseStats: { attack: 25, defence: 23, stamina: 22, speed: 25 } },
  { templateId: "cock_common_026", image: "/assets/Cocks/Common/Cock 26.png", rarity: "common", baseStats: { attack: 24, defence: 24, stamina: 23, speed: 22 } },
  { templateId: "cock_common_027", image: "/assets/Cocks/Common/Cock 27.png", rarity: "common", baseStats: { attack: 23, defence: 22, stamina: 25, speed: 23 } },
  { templateId: "cock_common_028", image: "/assets/Cocks/Common/Cock 28.png", rarity: "common", baseStats: { attack: 22, defence: 23, stamina: 24, speed: 24 } },
  { templateId: "cock_common_029", image: "/assets/Cocks/Common/Cock 29.png", rarity: "common", baseStats: { attack: 25, defence: 25, stamina: 23, speed: 22 } },
  { templateId: "cock_common_030", image: "/assets/Cocks/Common/Cock 30.jpg", rarity: "common", baseStats: { attack: 24, defence: 23, stamina: 22, speed: 24 } },
];

// Helper function to get random cock by rarity
export function getRandomCockByRarity(rarity: CockTemplate['rarity']): CockTemplate {
  const cocksOfRarity = COCK_TEMPLATES.filter(c => c.rarity === rarity);
  return cocksOfRarity[Math.floor(Math.random() * cocksOfRarity.length)];
}

// Helper function to get cock template by ID
export function getCockTemplate(templateId: string): CockTemplate | undefined {
  return COCK_TEMPLATES.find(c => c.templateId === templateId);
}
