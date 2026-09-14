/** Original small still lifes; no downloaded artwork, fonts, or runtime effects. */
export default function StoryScene({ kind }: { kind: 'fitness' | 'travel' }) {
  return (
    <svg
      className="story-scene"
      viewBox="0 0 200 116"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="var(--story-ink)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {kind === 'fitness' ? (
          <>
            <path d="M17 97c40-5 102-4 159 0" opacity=".2" />
            <path
              d="m24 67 5-14c3-6 11-6 17-3l35 16 12-7c7 0 18 16 14 24-16 8-34 6-49 2L23 79Z"
              fill="var(--story-paper)"
            />
            <path
              d="M23 79c29 12 60 14 84 4l-1 9c-19 9-54 6-84-5ZM48 55l-6 8m16-3-6 7m15-3-6 7m-27-18-5 16"
              fill="var(--story-clay)"
            />
            <path d="m133 29 21 .5 4 61c-4 5-22 6-28 0Z" fill="var(--story-leaf)" />
            <path d="m135 29 .4-8 16 .4 1 8m-16-8 1-6 12 .2 1 6m-15 28 20 1-1 25-21-1Z" />
            <path d="m105 41 12 5m-17-9 4-1 5 11-4 2Zm17 7 5-1 5 11-5 2ZM86 19c5 0 6 4 3 7m10-12-1 6" />
          </>
        ) : (
          <>
            <path d="M16 96c40 5 116 6 170-1" opacity=".2" />
            <path d="m28 79 34-51 28 47 27-33 50 52-137-2Z" fill="var(--story-leaf)" />
            <path d="m48 48 14 8 12-7m30 10 13 6 11-10" fill="var(--story-paper)" />
            <path d="M100 96c-20-8-3-17-17-26" strokeWidth="3" stroke="var(--story-paper)" />
            <path
              d="M135 16c18-2 20 23 4 24-17 1-21-21-4-24Z"
              fill="var(--story-sun)"
              stroke="none"
            />
            <path d="m126 75 11-2 4-6 20 1 5 8 15 2-2 28-54-3Z" fill="var(--story-clay)" />
            <path d="M150 81c16-1 18 21 3 22-15 1-17-20-3-22Zm23 1v2M26 35c5-6 10-5 13 0 4-4 8-3 11 0" />
          </>
        )}
      </g>
    </svg>
  );
}
