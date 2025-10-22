// Color mapping for each cock based on their template ID
export const COCK_COLORS: Record<string, number> = {
  // Common (30 cocks)
  'cock_common_001': 0x000000, // Black
  'cock_common_002': 0x000000, // Black
  'cock_common_003': 0xFFFFFF, // White
  'cock_common_004': 0xFFFF00, // Yellow
  'cock_common_005': 0xFFFF00, // Yellow
  'cock_common_006': 0xFFFFFF, // White
  'cock_common_007': 0x000000, // Black
  'cock_common_008': 0x000000, // Black
  'cock_common_009': 0x808080, // Grey
  'cock_common_010': 0x40E0D0, // Turquoise
  'cock_common_011': 0x000000, // Black
  'cock_common_012': 0xFFFFFF, // White
  'cock_common_013': 0x808080, // Grey
  'cock_common_014': 0xFFFFFF, // White
  'cock_common_015': 0x40E0D0, // Turquoise
  'cock_common_016': 0x000000, // Black
  'cock_common_017': 0x808080, // Grey
  'cock_common_018': 0xFFFFFF, // White
  'cock_common_019': 0x808080, // Grey
  'cock_common_020': 0x808080, // Grey
  'cock_common_021': 0x8B4513, // Brown
  'cock_common_022': 0x8B4513, // Brown
  'cock_common_023': 0xFFA500, // Orange
  'cock_common_024': 0xFFA500, // Orange
  'cock_common_025': 0xFFA500, // Orange
  'cock_common_026': 0xFFFFFF, // White
  'cock_common_027': 0xFFFFFF, // White
  'cock_common_028': 0x000000, // Black
  'cock_common_029': 0xFFFFFF, // White
  'cock_common_030': 0xFFFF00, // Yellow

  // Uncommon (22 cocks)
  'cock_uncommon_001': 0xFFA500, // Orange
  'cock_uncommon_002': 0xFFFFFF, // White
  'cock_uncommon_003': 0x000000, // Black
  'cock_uncommon_004': 0xFFFF00, // Yellow
  'cock_uncommon_005': 0x00FF00, // Green
  'cock_uncommon_006': 0xFFA500, // Orange
  'cock_uncommon_007': 0x000000, // Black
  'cock_uncommon_008': 0x808080, // Grey
  'cock_uncommon_009': 0xFFFFFF, // White
  'cock_uncommon_010': 0x000000, // Black
  'cock_uncommon_011': 0x000000, // Black
  'cock_uncommon_012': 0xFFFFFF, // White
  'cock_uncommon_013': 0x000000, // Black
  'cock_uncommon_014': 0xFFFFFF, // White
  'cock_uncommon_015': 0xFFFFFF, // White
  'cock_uncommon_016': 0xFFA500, // Orange
  'cock_uncommon_017': 0x000000, // Black
  'cock_uncommon_018': 0x808080, // Grey
  'cock_uncommon_019': 0x8B4513, // Brown
  'cock_uncommon_020': 0xFFA500, // Orange
  'cock_uncommon_021': 0x8B4513, // Brown
  'cock_uncommon_022': 0xFFA500, // Orange

  // Rare (19 cocks)
  'cock_rare_001': 0xFFA500, // Orange
  'cock_rare_002': 0xFFA500, // Orange
  'cock_rare_003': 0xFFA500, // Orange
  'cock_rare_004': 0xFF0000, // Red
  'cock_rare_005': 0xFFA500, // Orange
  'cock_rare_006': 0xFFFF00, // Yellow
  'cock_rare_007': 0x808080, // Grey
  'cock_rare_008': 0x000000, // Black
  'cock_rare_009': 0x000000, // Black
  'cock_rare_010': 0xFFFFFF, // White
  'cock_rare_011': 0xFFA500, // Orange
  'cock_rare_012': 0x000000, // Black
  'cock_rare_013': 0x808080, // Grey
  'cock_rare_014': 0x808080, // Grey
  'cock_rare_015': 0x800080, // Purple
  'cock_rare_016': 0xFFFFFF, // White
  'cock_rare_017': 0xFFFFFF, // White
  'cock_rare_018': 0xFFFFFF, // White
  'cock_rare_019': 0xFFA500, // Orange

  // Epic (11 cocks)
  'cock_epic_001': 0xFFFF00, // Yellow
  'cock_epic_002': 0x000000, // Black
  'cock_epic_003': 0xFFFFFF, // White
  'cock_epic_004': 0x808080, // Grey
  'cock_epic_005': 0xFFA500, // Orange
  'cock_epic_006': 0xFFFFFF, // White
  'cock_epic_007': 0xFFFF00, // Yellow
  'cock_epic_008': 0x0000FF, // Blue
  'cock_epic_009': 0xFFA500, // Orange
  'cock_epic_010': 0x808080, // Grey
  'cock_epic_011': 0x8B4513, // Brown

  // Legendary (9 cocks)
  'cock_legendary_001': 0x808080, // Grey
  'cock_legendary_002': 0x000000, // Black
  'cock_legendary_003': 0x808080, // Grey
  'cock_legendary_004': 0xADD8E6, // Light Blue
  'cock_legendary_005': 0xADD8E6, // Light Blue
  'cock_legendary_006': 0xB19CD9, // Light Purple
  'cock_legendary_007': 0xCD7F32, // Bronze
  'cock_legendary_008': 0xE6F2FF, // Blue almost white
  'cock_legendary_009': 0xFFFFFF, // White
};

// Get color for a cock by template ID
export const getCockColor = (templateId: string): number => {
  return COCK_COLORS[templateId] || 0x000000; // Default black color if not found
};

// Helper to get multiple colors for legendary effects (for future animation use)
export const getLegendaryColors = (templateId: string): number[] => {
  const legendaryEffects: Record<string, number[]> = {
    'cock_legendary_001': [0xFF0000, 0xFF7F00, 0xFFFF00, 0x00FF00, 0x0000FF, 0x4B0082, 0x9400D3], // Rainbow
    'cock_legendary_002': [0x000033, 0x4B0082, 0x9400D3, 0xFFFFFF], // Galaxy
    'cock_legendary_003': [0x000000, 0x4B0082, 0x9400D3, 0xFF00FF], // Cosmic
    'cock_legendary_004': [0x8A2BE2, 0xFF1493, 0x00FFFF], // Nebula
    'cock_legendary_005': [0x00FF00, 0x00FFAA, 0xFF00FF], // Aurora
    'cock_legendary_006': [0xFF0000, 0x00FF00, 0x0000FF, 0xFF00FF, 0xFFFF00, 0x00FFFF], // Prism
    'cock_legendary_007': [0xFF0000, 0xFF7F00, 0xFFFF00, 0x00FF00, 0x0000FF, 0x9400D3], // Spectrum
    'cock_legendary_008': [0xB0E0E6, 0xFFFFFF, 0x87CEEB], // Celestial
    'cock_legendary_009': [0xE0FFFF, 0xF0FFFF, 0xFFFFFF, 0xE6E6FA], // Ethereal
  };

  return legendaryEffects[templateId] || [getCockColor(templateId)];
};

export default getCockColor;
