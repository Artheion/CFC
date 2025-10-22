import { Cock } from '../types';
import { getCockImage } from '../utils/cockImages';
import { getCockHolographicConfig } from '../utils/cockHoloStyles';
import HolographicCard from './ui/HolographicCard';

interface CockCardProps {
  cock: Cock;
  onClick?: () => void;
  selectable?: boolean;
  selected?: boolean;
}

const rarityColors = {
  common: 'border-dark-600 hover:border-gray-500',
  uncommon: 'border-emerald-700/40 hover:border-emerald-500',
  rare: 'border-blue-600/50 hover:border-blue-500',
  epic: 'border-purple-600/50 hover:border-purple-500',
  legendary: 'border-primary-600/50 hover:border-primary-500 shadow-red-glow',
};

const rarityBg = {
  common: 'bg-gradient-to-br from-dark-800 to-dark-900',
  uncommon: 'bg-gradient-to-br from-emerald-900/20 to-dark-900',
  rare: 'bg-gradient-to-br from-blue-900/20 to-dark-900',
  epic: 'bg-gradient-to-br from-purple-900/20 to-dark-900',
  legendary: 'bg-gradient-to-br from-primary-900/20 via-red-900/20 to-dark-900',
};

const rarityGlow = {
  common: '',
  uncommon: 'group-hover:shadow-[0_0_30px_rgba(16,185,129,0.25)]',
  rare: 'group-hover:shadow-[0_0_30px_rgba(59,130,246,0.3)]',
  epic: 'group-hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]',
  legendary: 'group-hover:shadow-red-glow-lg',
};

const rarityBadge = {
  common: 'bg-gray-700/50 text-gray-300 border-gray-600/50',
  uncommon: 'bg-emerald-900/50 text-emerald-300 border-emerald-600/50',
  rare: 'bg-blue-900/50 text-blue-300 border-blue-600/50',
  epic: 'bg-purple-900/50 text-purple-300 border-purple-600/50',
  legendary: 'bg-gradient-red text-white border-primary-500/50 shadow-red-glow',
};

const CockCard = ({ cock, onClick, selectable, selected }: CockCardProps) => {
  const cockImage = getCockImage(cock.image);
  const holographic = getCockHolographicConfig(cock.rarity);

  return (
    <div
      className={`card cursor-pointer hover:scale-[1.02] transition-all duration-300 border ${
        rarityColors[cock.rarity]
      } ${rarityGlow[cock.rarity]} ${selected ? 'ring-2 ring-primary-500 shadow-red-glow-lg scale-[1.02]' : ''} relative overflow-hidden group`}
      onClick={onClick}
    >
      <HolographicCard
        intensity={holographic.intensity}
        gradientStops={holographic.gradientStops}
        glowColor={holographic.glowColor}
        sheen={holographic.sheen}
        rotation={holographic.rotation}
        scanlines={holographic.scanlines}
        className={`aspect-square ${rarityBg[cock.rarity]} mb-4 flex items-center justify-center relative overflow-hidden border border-dark-700 transition-all`}
      >
        <img
          src={cockImage}
          alt={`${cock.name} portrait`}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-dark-950/85 via-transparent to-transparent" />
        <div className="absolute top-2 right-2">
          <div className={`text-xs px-2 py-1 rounded-full border ${rarityBadge[cock.rarity]} font-bold uppercase tracking-wider backdrop-blur-sm`}>
            {cock.rarity}
          </div>
        </div>
      </HolographicCard>
      <h3 className="font-bold text-white truncate text-lg mb-2">{cock.name}</h3>
      <div className="flex justify-between items-center text-sm glass p-2.5 border border-dark-700">
        <span className="text-green-400 font-semibold flex items-center gap-1.5">
          <span className="text-base">🏆</span> {cock.wins}
        </span>
        <span className="text-gray-500">|</span>
        <span className="text-red-400 font-semibold flex items-center gap-1.5">
          <span className="text-base">💀</span> {cock.losses}
        </span>
      </div>
      <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary-600/10 to-transparent-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
    </div>
  );
};

export default CockCard;