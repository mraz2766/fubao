import { useEffect, useRef, useState } from 'react';
import { select } from 'd3-selection';
import { zoom, zoomIdentity } from 'd3-zoom';
import { Plus, Minus, RotateCcw, MapPin, ArrowUpRight } from 'lucide-react';
import type { Locale } from '../../types/domain';
import { translator } from '../../lib/i18n';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
interface Country {
  code: string;
  name: string;
  name_zh: string;
  path: string;
}
export interface MapEntry {
  id: string;
  code: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  x: number | null;
  y: number | null;
  photoId?: string;
}
export default function InteractiveMap({
  locale,
  countries,
  entries,
  wishes,
}: {
  locale: Locale;
  countries: Country[];
  entries: MapEntry[];
  wishes: string[];
}) {
  const t = translator(locale),
    ref = useRef<SVGSVGElement>(null),
    group = useRef<SVGGElement>(null),
    [country, setCountry] = useState<Country | null>(null);
  const controller = useRef<ReturnType<typeof zoom<SVGSVGElement, unknown>> | null>(null);
  useEffect(() => {
    if (!ref.current || !group.current) return;
    const root = select(ref.current);
    const behavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 6])
      .extent([
        [0, 0],
        [800, 390],
      ])
      .translateExtent([
        [-200, -100],
        [1000, 490],
      ])
      .filter((event) => (event.type === 'wheel' ? event.ctrlKey : !event.button))
      .on('zoom', (event) => {
        select(group.current).attr('transform', event.transform.toString());
      });
    root.call(behavior).on('dblclick.zoom', null);
    controller.current = behavior;
    return () => {
      root.on('.zoom', null);
    };
  }, []);
  function scale(factor: number) {
    if (ref.current && controller.current)
      select(ref.current).call(controller.current.scaleBy, factor);
  }
  function reset() {
    if (ref.current && controller.current)
      select(ref.current).call(controller.current.transform, zoomIdentity);
  }
  const visited = new Set(entries.map((e) => e.code)),
    list = countries.filter((c) => visited.has(c.code) || wishes.includes(c.code));
  return (
    <div>
      <div className="map-frame">
        <svg
          ref={ref}
          viewBox="0 0 800 390"
          className="interactive-map"
          role="img"
          aria-label={t('travel.map')}
        >
          <g ref={group}>
            {countries.map((c) => (
              <path
                key={c.code + c.name}
                d={c.path}
                className={`map-country ${visited.has(c.code) ? 'visited' : ''} ${wishes.includes(c.code) ? 'wish' : ''}`}
                onClick={() => setCountry(c)}
              >
                <title>{locale === 'zh-CN' ? c.name_zh || c.name : c.name}</title>
              </path>
            ))}
            {entries
              .filter((e) => e.x !== null && e.y !== null)
              .map((e) => (
                <circle
                  key={e.id}
                  cx={e.x!}
                  cy={e.y!}
                  r="3"
                  className="map-point"
                  onClick={() => setCountry(countries.find((c) => c.code === e.code) ?? null)}
                />
              ))}
          </g>
        </svg>
        <div className="map-controls">
          <Button
            variant="secondary"
            size="icon"
            onClick={() => scale(1.5)}
            aria-label={t('travel.zoomIn')}
          >
            <Plus size={17} />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            onClick={() => scale(1 / 1.5)}
            aria-label={t('travel.zoomOut')}
          >
            <Minus size={17} />
          </Button>
          <Button variant="secondary" size="icon" onClick={reset} aria-label={t('travel.resetMap')}>
            <RotateCcw size={15} />
          </Button>
        </div>
      </div>
      <div className="map-legend">
        <span>
          <i className="legend-visited" />
          {t('travel.visited')}
        </span>
        <span>
          <i className="legend-wish" />
          {t('travel.want')}
        </span>
      </div>
      {list.length > 0 && (
        <details className="country-list">
          <summary>{t('travel.countryList')}</summary>
          <div className="part-options">
            {list.map((c) => (
              <Button key={c.code} variant="ghost" onClick={() => setCountry(c)}>
                {locale === 'zh-CN' ? c.name_zh || c.name : c.name}
              </Button>
            ))}
          </div>
        </details>
      )}
      <Dialog
        open={!!country}
        onOpenChange={(open) => !open && setCountry(null)}
        title={country ? (locale === 'zh-CN' ? country.name_zh || country.name : country.name) : ''}
        locale={locale}
      >
        {country && (
          <>
            <div className="stats-inline">
              <div className="stat">
                <strong>{entries.filter((e) => e.code === country.code).length}</strong>
                <span>{t('travel.trips')}</span>
              </div>
              <span className="badge">
                {visited.has(country.code)
                  ? t('travel.visited')
                  : wishes.includes(country.code)
                    ? t('travel.want')
                    : t('common.empty')}
              </span>
            </div>
            {entries
              .filter((e) => e.code === country.code)
              .map((e) => (
                <a key={e.id} className="recent-row" href={`/travel/${e.id}`}>
                  {e.photoId ? (
                    <img
                      src={`/api/media/${e.photoId}/thumbnail`}
                      alt=""
                      width={64}
                      height={48}
                      loading="lazy"
                      style={{ objectFit: 'cover', borderRadius: 7 }}
                    />
                  ) : (
                    <MapPin size={18} />
                  )}
                  <span className="recent-info">{e.city}</span>
                  <ArrowUpRight size={16} />
                </a>
              ))}
          </>
        )}
      </Dialog>
    </div>
  );
}
