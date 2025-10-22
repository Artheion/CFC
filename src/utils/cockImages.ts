import { Cock } from '../types';
import { COCK_TEMPLATES, getRandomCockByRarity } from '../data/cocks';

export const getCockImage = (imageUrl: string): string => {
  return imageUrl;
};

export const getRandomCockTemplate = (rarity: Cock['rarity']) => {
  return getRandomCockByRarity(rarity);
};

export default COCK_TEMPLATES;
