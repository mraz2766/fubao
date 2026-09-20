import type { CSSProperties } from 'react';
import { Home, Dumbbell, MapPin, Settings, Sun, Moon, Sprout, Camera } from 'lucide-react';
export type StoryKind =
  'home' | 'fitness' | 'travel' | 'settings' | 'sun' | 'moon' | 'plant' | 'camera';
/** Shared functional icons; the cat mark is reserved for the brand. */
export default function StoryIcon({
  kind,
  size = 24,
  className = '',
  style,
}: {
  kind: StoryKind;
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const Icon = {
    home: Home,
    fitness: Dumbbell,
    travel: MapPin,
    settings: Settings,
    sun: Sun,
    moon: Moon,
    plant: Sprout,
    camera: Camera,
  }[kind];
  return (
    <Icon size={size} className={className} style={style} strokeWidth={1.7} aria-hidden="true" />
  );
}
