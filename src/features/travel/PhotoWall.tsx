import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpRight } from 'lucide-react';
import type { Locale } from '../../types/domain';
import { translator } from '../../lib/i18n';
import { Button } from '../../components/ui/button';
const Dialog = lazy(() =>
  import('../../components/ui/dialog').then((module) => ({ default: module.Dialog })),
);
export interface WallPhoto {
  id: string;
  travelId: string;
  width: number;
  height: number;
  label: string;
  year: string;
}
export default function PhotoWall({
  locale,
  photos,
  detail = false,
}: {
  locale: Locale;
  photos: WallPhoto[];
  detail?: boolean;
}) {
  const t = translator(locale),
    [index, setIndex] = useState<number | null>(null),
    photo = index === null ? null : photos[index];
  const trigger = useRef<HTMLButtonElement | null>(null);
  const close = () => {
    setIndex(null);
    requestAnimationFrame(() => trigger.current?.focus());
  };
  const years = [...new Set(photos.map((p) => p.year))];
  const move = (direction: number) =>
    setIndex((i) => (i === null ? null : (i + direction + photos.length) % photos.length));
  useEffect(() => {
    if (index === null) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        move(1);
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        move(-1);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [index, photos.length]);
  return (
    <>
      {!photos.length && <div className="empty">{t('travel.noPhotos')}</div>}
      {years.map((year) => (
        <section key={year} className="photo-year">
          {!detail && <h2>{year || t('common.undated')}</h2>}
          <div className={`photo-wall ${detail ? 'detail-photos' : ''}`}>
            {photos
              .filter((p) => p.year === year)
              .map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="wall-photo"
                  onClick={(event) => {
                    trigger.current = event.currentTarget;
                    setIndex(photos.findIndex((x) => x.id === p.id));
                  }}
                  aria-label={p.label}
                >
                  <img
                    src={`/api/media/${p.id}/${detail ? 'large' : 'thumbnail'}`}
                    srcSet={
                      detail
                        ? `/api/media/${p.id}/thumbnail 480w, /api/media/${p.id}/large 1920w`
                        : undefined
                    }
                    alt={p.label}
                    width={p.width}
                    height={p.height}
                    sizes="(max-width: 640px) 45vw, 25vw"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ))}
          </div>
        </section>
      ))}
      {photo && (
        <Suspense fallback={<p role="status">{t('common.loading')}</p>}>
          <Dialog
            open={!!photo}
            onOpenChange={(open) => !open && close()}
            title={photo?.label ?? ''}
            locale={locale}
            wide
          >
            {photo && (
              <div className="lightbox">
                <img
                  src={`/api/media/${photo.id}/large`}
                  alt={photo.label}
                  width={photo.width}
                  height={photo.height}
                />
                <div className="lightbox-controls">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('travel.photoPrevious')}
                    onClick={() => move(-1)}
                    disabled={photos.length < 2}
                  >
                    <ChevronLeft size={22} />
                  </Button>
                  <span className="muted small">
                    {index! + 1} / {photos.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('travel.photoNext')}
                    onClick={() => move(1)}
                    disabled={photos.length < 2}
                  >
                    <ChevronRight size={22} />
                  </Button>
                  {!detail && (
                    <a className="text-link" href={`/travel/${photo.travelId}`}>
                      {t('travel.viewTrip')}
                      <ArrowUpRight size={15} />
                    </a>
                  )}
                </div>
              </div>
            )}
          </Dialog>
        </Suspense>
      )}
    </>
  );
}
