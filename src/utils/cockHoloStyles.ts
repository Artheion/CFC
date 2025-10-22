import type { Cock } from '../types';

export interface CockHolographicConfig {
  intensity: number;
  gradientStops: string[];
  glowColor: string;
  sheen: number;
  scanlines?: boolean;
  rotation?: number;
}

const holographicConfig: Record<Cock['rarity'], CockHolographicConfig> = {
  common: {
    intensity: 0.24,
    gradientStops: [
      'rgba(148,163,184,0.28)',
      'rgba(96,165,250,0.24)',
      'rgba(79,70,229,0.2)',
    ],
    glowColor: 'rgba(148,163,184,0.25)',
    sheen: 0.28,
  },
  uncommon: {
    intensity: 0.28,
    gradientStops: [
      'rgba(34,197,94,0.3)',
      'rgba(45,212,191,0.26)',
      'rgba(59,130,246,0.18)',
    ],
    glowColor: 'rgba(34,197,94,0.28)',
    sheen: 0.34,
  },
  rare: {
    intensity: 0.32,
    gradientStops: [
      'rgba(59,130,246,0.32)',
      'rgba(99,102,241,0.3)',
      'rgba(129,140,248,0.35)',
    ],
    glowColor: 'rgba(59,130,246,0.36)',
    sheen: 0.38,
  },
  epic: {
    intensity: 0.34,
    gradientStops: [
      'rgba(192,132,252,0.36)',
      'rgba(236,72,153,0.34)',
      'rgba(56,189,248,0.22)',
    ],
    glowColor: 'rgba(192,132,252,0.4)',
    sheen: 0.42,
    scanlines: true,
  },
  legendary: {
    intensity: 0.38,
    gradientStops: [
      'rgba(250,204,21,0.45)',
      'rgba(239,68,68,0.4)',
      'rgba(217,119,6,0.42)',
    ],
    glowColor: 'rgba(249,115,22,0.5)',
    sheen: 0.48,
    scanlines: true,
    rotation: 18,
  },
};

export const getCockHolographicConfig = (
  rarity: Cock['rarity'],
): CockHolographicConfig => holographicConfig[rarity];

export default holographicConfig;
