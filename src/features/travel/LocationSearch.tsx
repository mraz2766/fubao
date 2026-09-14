import { useEffect, useId, useState, useRef } from 'react';
import { Button } from '../../components/ui/button';
import { MapPin, Search } from 'lucide-react';
import type { Locale, Location } from '../../types/domain';
import { translator, locationRegion } from '../../lib/i18n';
import { api, errorText } from '../../lib/api';
export const locationName = (location: Location, locale: Locale) =>
  locale === 'zh-CN' ? location.name_zh || location.name : location.name;
export default function LocationSearch({
  locale,
  selected,
  onSelect,
  recent = false,
  allowManual = false,
}: {
  locale: Locale;
  selected: Location | null;
  recent?: boolean;
  allowManual?: boolean;
  onSelect: (location: Location) => void;
}) {
  const t = translator(locale),
    [query, setQuery] = useState(''),
    [items, setItems] = useState<Location[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    [retry, setRetry] = useState(0),
    id = useId();
  const [editing, setEditing] = useState(false),
    [recentItems, setRecentItems] = useState<Location[]>([]);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (recent)
      void api<{ items: Location[] }>('/api/travel/recent-locations')
        .then((r) => setRecentItems(r.items))
        .catch(() => {});
  }, [recent]);
  const choose = (item: Location) => {
    onSelect(item);
    setEditing(false);
    setQuery('');
    setItems([]);
    setError('');
  };
  const expanded = !selected || editing;
  useEffect(() => {
    if (editing) input.current?.focus();
  }, [editing]);
  useEffect(() => {
    if (!query.trim()) {
      setItems([]);
      setError('');
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setItems([]);
    const timeout = setTimeout(() => {
      api<{ items: Location[] }>(`/api/locations?preferCountry=CN&q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((result) => {
          setItems(result.items);
          setError('');
        })
        .catch((e) => {
          if (e.name !== 'AbortError') setError(errorText(e, locale));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 200);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, locale, retry]);
  return (
    <div>
      <label className="field" htmlFor={expanded ? id : undefined}>
        <span>{t('travel.location')}</span>
      </label>
      {selected && (
        <div className="selected-location">
          <MapPin size={16} />
          <strong>{locationName(selected, locale)}</strong>
          <span className="muted small">
            {selected.country_code === 'CN'
              ? locationRegion(selected, locale) === locationName(selected, locale)
                ? ''
                : locationRegion(selected, locale)
              : locale === 'zh-CN'
                ? selected.country_name_zh || selected.country_name
                : selected.country_name}
          </span>
          <Button type="button" variant="ghost" onClick={() => setEditing(!editing)}>
            {t(editing ? 'common.cancel' : 'flow.changePlace')}
          </Button>
        </div>
      )}
      {expanded && (
        <label className="search-field">
          <Search size={17} />
          <input
            ref={input}
            id={id}
            placeholder={t('travel.searchLocation')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </label>
      )}
      {expanded && !query && recentItems.length > 0 && (
        <div className="recent-places">
          <p className="small muted">{t('flow.recentPlaces')}</p>
          <div className="part-options">
            {recentItems.map((item) => (
              <Button
                type="button"
                variant="secondary"
                key={item.spot_id ?? item.id}
                onClick={() => choose(item)}
              >
                {locationName(item, locale)}
              </Button>
            ))}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="form-message error">
          {error}
          <Button type="button" variant="ghost" onClick={() => setRetry((n) => n + 1)}>
            {t('common.retry')}
          </Button>
        </p>
      )}
      {allowManual && expanded && query.trim() && !loading && (error || !items.length) && (
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            choose({
              id: 'manual-place',
              kind: 'region',
              country_code: '',
              country_name: '',
              country_name_zh: '',
              region: '',
              city: '',
              name: query.trim(),
              name_zh: query.trim(),
              latitude: null,
              longitude: null,
            })
          }
        >
          {t('ia.manualPlace')} · {query.trim()}
        </Button>
      )}
      {expanded && query && (
        <div className="location-results" aria-live="polite">
          {loading ? (
            <p className="small muted">{t('common.loading')}</p>
          ) : items.length ? (
            items.map((item) => (
              <button
                type="button"
                key={item.spot_id ?? item.id}
                onClick={() => {
                  choose(item);
                }}
              >
                <MapPin size={16} />
                <span>
                  <strong>{locationName(item, locale)}</strong>
                  <small>
                    {item.region && item.kind === 'city'
                      ? `${locationRegion(item, locale)} · `
                      : ''}
                    {locale === 'zh-CN'
                      ? item.country_name_zh || item.country_name
                      : item.country_name}
                  </small>
                </span>
              </button>
            ))
          ) : (
            <p className="small muted">{t('travel.noLocations')}</p>
          )}
        </div>
      )}
    </div>
  );
}
