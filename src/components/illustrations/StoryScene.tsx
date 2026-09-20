import { Dumbbell, MapPin } from 'lucide-react';
/** Quiet placeholder for records without imagery. */
export default function StoryScene({ kind }: { kind: 'fitness' | 'travel' }) {
  const Icon = kind === 'fitness' ? Dumbbell : MapPin;
  return <Icon className="story-scene" size={40} strokeWidth={1.3} aria-hidden="true" />;
}
