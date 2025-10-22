export interface ChickenTemplate {
  templateId: string;
  image: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
}

export const CHICKEN_TEMPLATES: ChickenTemplate[] = [
  // Legendary Chickens
  { templateId: "chicken_legendary_001", image: "/assets/Chickens/Legendary/Chicken 1.jpg", rarity: "legendary" },
  { templateId: "chicken_legendary_002", image: "/assets/Chickens/Legendary/Chicken 2.png", rarity: "legendary" },

  // Epic Chickens
  { templateId: "chicken_epic_001", image: "/assets/Chickens/Epic/Chicken 1.jpg", rarity: "epic" },
  { templateId: "chicken_epic_002", image: "/assets/Chickens/Epic/Chicken 2.jpg", rarity: "epic" },

  // Rare Chickens
  { templateId: "chicken_rare_001", image: "/assets/Chickens/Rare/Chicken 1.png", rarity: "rare" },
  { templateId: "chicken_rare_002", image: "/assets/Chickens/Rare/Chicken 2.jpg", rarity: "rare" },
  { templateId: "chicken_rare_003", image: "/assets/Chickens/Rare/Chicken 3.jpg", rarity: "rare" },

  // Uncommon Chickens
  { templateId: "chicken_uncommon_001", image: "/assets/Chickens/Uncommon/Chicken 1.png", rarity: "uncommon" },
  { templateId: "chicken_uncommon_002", image: "/assets/Chickens/Uncommon/Chicken 2.jpg", rarity: "uncommon" },
  { templateId: "chicken_uncommon_003", image: "/assets/Chickens/Uncommon/Chicken 3.jpg", rarity: "uncommon" },

  // Common Chickens
  { templateId: "chicken_common_001", image: "/assets/Chickens/Common/Chicken 1.jpg", rarity: "common" },
  { templateId: "chicken_common_002", image: "/assets/Chickens/Common/Chicken 2.jpg", rarity: "common" },
  { templateId: "chicken_common_003", image: "/assets/Chickens/Common/Chicken 3.jpg", rarity: "common" },
];

// Helper function to get random chicken by rarity
export function getRandomChickenByRarity(rarity: ChickenTemplate['rarity']): ChickenTemplate {
  const chickensOfRarity = CHICKEN_TEMPLATES.filter(c => c.rarity === rarity);
  return chickensOfRarity[Math.floor(Math.random() * chickensOfRarity.length)];
}

// Helper function to get chicken template by ID
export function getChickenTemplate(templateId: string): ChickenTemplate | undefined {
  return CHICKEN_TEMPLATES.find(c => c.templateId === templateId);
}
