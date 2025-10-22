import type { CSSProperties, HTMLAttributes, PointerEvent } from 'react';
import { useMemo, useRef, useState } from 'react';

type ClassValue = string | undefined | null | false;

const cn = (...values: ClassValue[]): string => values.filter(Boolean).join(' ');

const DEFAULT_STOPS = [
  'rgba(59,130,246,0.35)',
  'rgba(236,72,153,0.28)',
  'rgba(14,165,233,0.32)',
];

interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface HolographicCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'style'> {
  intensity?: number;
  gradientStops?: string[];
  glowColor?: string;
  sheen?: number;
  rotation?: number;
  scanlines?: boolean;
  style?: CSSProperties;
  interactive?: boolean;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const clampChannel = (value: number) => Math.round(clamp(value, 0, 255));

const parseRGBA = (color: string): RGB | null => {
  const match = color.match(/rgba?\(([^)]+)\)/i);
  if (!match) return null;
  const parts = match[1]
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;
  const [r, g, b] = parts;
  const toNumber = (value: string) => {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  return {
    r: clampChannel(toNumber(r)),
    g: clampChannel(toNumber(g)),
    b: clampChannel(toNumber(b)),
  };
};

const mixChannel = (channel: number, amount: number) =>
  clampChannel(channel + (255 - channel) * amount);

const lighten = (color: RGB, amount: number): RGB => ({
  r: mixChannel(color.r, amount),
  g: mixChannel(color.g, amount),
  b: mixChannel(color.b, amount),
});

const darken = (color: RGB, amount: number): RGB => ({
  r: clampChannel(color.r * (1 - amount)),
  g: clampChannel(color.g * (1 - amount)),
  b: clampChannel(color.b * (1 - amount)),
});

const toRGBA = (color: RGB, alpha: number) =>
  `rgba(${color.r}, ${color.g}, ${color.b}, ${clamp(alpha, 0, 1)})`;

const HolographicCard = ({
  children,
  className,
  intensity = 0.28,
  gradientStops = DEFAULT_STOPS,
  glowColor = 'rgba(59,130,246,0.35)',
  sheen = 0.35,
  rotation = 16,
  scanlines = false,
  onPointerEnter,
  onPointerLeave,
  onPointerMove,
  interactive = true,
  style: inlineStyle,
  ...rest
}: HolographicCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0.5, y: 0.5 });
  const [active, setActive] = useState(false);

  const angle = useMemo(() => {
    const radians = Math.atan2(mouse.y - 0.5, mouse.x - 0.5);
    return (radians * 180) / Math.PI;
  }, [mouse]);

  const gradient = useMemo(() => {
    const stops = gradientStops.length ? gradientStops : DEFAULT_STOPS;
    return `linear-gradient(${angle}deg, ${stops.join(', ')})`;
  }, [angle, gradientStops]);

  const metallicPalette = useMemo(() => {
    const base = parseRGBA(glowColor);
    if (!base) {
      return {
        highlight: 'rgba(255,255,255,0.92)',
        mid: 'rgba(226,232,240,0.82)',
        base: glowColor,
        shadow: 'rgba(71,85,105,0.74)',
        deep: 'rgba(30,41,59,0.68)',
      } as const;
    }
    const highlight = toRGBA(lighten(base, 0.42), 0.96);
    const mid = toRGBA(lighten(base, 0.22), 0.88);
    const baseTint = toRGBA(base, 0.82);
    const shadow = toRGBA(darken(base, 0.18), 0.74);
    const deep = toRGBA(darken(base, 0.34), 0.68);
    return { highlight, mid, base: baseTint, shadow, deep } as const;
  }, [glowColor]);

  const metallicGradient = useMemo(() => {
    const { highlight, mid, base, shadow, deep } = metallicPalette;
    return `conic-gradient(from ${angle}deg,
      ${highlight} 0deg,
      ${mid} 40deg,
      ${base} 95deg,
      ${shadow} 150deg,
      ${deep} 210deg,
      ${highlight} 270deg,
      ${mid} 315deg,
      ${base} 360deg
    )`;
  }, [angle, metallicPalette]);

  const sheenGradient = useMemo(
    () =>
      `radial-gradient(circle at ${mouse.x * 100}% ${mouse.y * 100}%, rgba(255,255,255,${0.4 * sheen}) 0%, rgba(255,255,255,0) 55%)`,
    [mouse, sheen],
  );

  const transform = useMemo(() => {
    if (!interactive) {
      return 'none';
    }
    const rotateX = (0.5 - mouse.y) * rotation;
    const rotateY = (mouse.x - 0.5) * rotation;
    const scale = active ? 1.02 : 1;
    return `perspective(950px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`;
  }, [mouse, rotation, active, interactive]);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!interactive) {
      onPointerMove?.(event);
      return;
    }
    const element = cardRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    setMouse({ x: clamp(x, 0, 1), y: clamp(y, 0, 1) });

    onPointerMove?.(event);
  };

  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (interactive) {
      setActive(true);
    }
    onPointerEnter?.(event);
  };

  const handlePointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (interactive) {
      setActive(false);
      setMouse({ x: 0.5, y: 0.5 });
    }
    onPointerLeave?.(event);
  };

  const cardStyle: CSSProperties = {
    ...inlineStyle,
    transform,
  };

  if (glowColor) {
    const existingShadow = inlineStyle?.boxShadow;
    const glow = `0 22px 50px -28px ${glowColor}`;
    cardStyle.boxShadow = existingShadow ? `${existingShadow}, ${glow}` : glow;
  }

  cardStyle.borderColor = 'transparent';
  cardStyle.borderImageSource = metallicGradient;
  cardStyle.borderImageSlice = 1;
  cardStyle.borderImageWidth = 1;
  cardStyle.borderImageRepeat = 'stretch';

  return (
    <div
      ref={cardRef}
      className={cn(
        'relative overflow-hidden transition-transform duration-200 ease-out will-change-transform [&>img]:brightness-105 [&>img]:contrast-105',
        className,
      )}
      style={cardStyle}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      {...rest}
    >
      {/* Subtle color dodge for shimmer */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-color-dodge z-20"
        style={{ background: gradient, opacity: intensity * 0.4 }}
      />
      {/* Overlay for subtle depth */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-overlay z-20"
        style={{ background: gradient, opacity: intensity * 0.3 }}
      />
      {/* Sheen effect */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-soft-light z-30"
        style={{ background: sheenGradient, opacity: sheen * (active ? 0.9 : 0.6) }}
      />
      {/* Screen blend for subtle glow */}
      <div
        className="pointer-events-none absolute inset-0 mix-blend-screen z-30"
        style={{ background: gradient, opacity: intensity * 0.3 }}
      />
      {scanlines && (
        <div
          className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-35 z-40"
          style={{
            background:
              'repeating-linear-gradient(180deg, rgba(255,255,255,0.12) 0px, rgba(255,255,255,0.05) 1px, transparent 2px, transparent 3px)',
          }}
        />
      )}
      <div className="relative z-10 h-full w-full">{children}</div>
    </div>
  );
};

export default HolographicCard;
