import type { CSSProperties } from 'react';
export type StoryKind =
  'home' | 'fitness' | 'travel' | 'settings' | 'sun' | 'moon' | 'plant' | 'camera';
/** Original Fubao line drawings. Small asymmetries are drawn into the paths, not animated filters. */
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
  const drawings = {
    home: (
      <>
        <path d="M4 16 15.7 5 28 15.5M7 13.5l.6 14 17-.4.5-13.1" />
        <path d="m13 27-.2-9 6-.1.4 9M21 7l.1-3 4 .4v6" />
        <path d="M5 28.5c7-1 15 .4 23-.5" opacity=".4" />
      </>
    ),
    fitness: (
      <>
        <path d="m10 13 12 5M8 8l4 1-5 15-4-1zM12 10l3 1-4 12-3-1M23 13l4 1-5 15-4-1zM20 13l3 1-4 12-3-1" />
        <path d="m18 4 1 3m6-1-2 2M4 28l9 .4" opacity=".5" />
      </>
    ),
    travel: (
      <>
        <path d="m3 26 9-17 6 11 4-8 8 14c-8 1-18 .6-27 0Z" />
        <path d="m9 15 3 2 3-2m5 2 2 1 2-1M16 27c-3-6 4-5 1-10" />
        <path d="M21 5a3 3 0 1 0 .2 0Z" fill="var(--story-sun)" stroke="none" />
      </>
    ),
    settings: (
      <>
        <path d="m7 7 3-3 7 8-4 4Zm6 9 12 12 3-3-12-12M25 4c-5-1-8 3-6 7L5 25l3 3 14-15c5 1 9-4 6-8l-4 5-3-3Z" />
      </>
    ),
    sun: (
      <>
        <path d="M15.5 9c9-1 10 13 1 14-9 1-11-12-1-14Z" fill="var(--story-sun)" />
        <path d="m16 2 .2 3M16 27v3M2 16h3m22 0h3M6 5l2 3m17-2-2 2M6 26l2-3m17 3-2-2" />
        <path d="m12 16 .1.2m8-.2.1.2m-6 3c1 1 3 1 4 0" strokeWidth="1.2" />
      </>
    ),
    moon: (
      <>
        <path d="M21 4c-6 7-3 17 6 18C14 34 0 16 12 5c2-2 5-2 9-1Z" fill="var(--story-sun)" />
        <path d="m26 7 1 2 2 1-2 1-1 2-1-2-2-1 2-1Z" />
      </>
    ),
    plant: (
      <>
        <path
          d="M16 23c1-8-2-13-1-20M16 14C7 15 3 10 4 6c7-1 11 2 12 8ZM16 18c1-7 6-9 12-8-1 6-6 9-12 8Z"
          fill="var(--story-leaf)"
        />
        <path d="m9 22 15 .4-2 8-11-.2Z" fill="var(--story-clay)" />
        <path d="m8 22 17 .2" />
      </>
    ),
    camera: (
      <>
        <path d="m4 10 6-.4 2-4 9 .5 2 4 6 .5-.4 17-25-.7Z" fill="var(--story-paper)" />
        <path d="M16 13c8-1 9 11 1 12-8 .5-9-11-1-12Zm9 0v1M5 7h4" />
      </>
    ),
  };
  return (
    <svg
      className={`story-icon ${className}`}
      style={style}
      width={size}
      height={size}
      viewBox="0 0 32 34"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {drawings[kind]}
    </svg>
  );
}
