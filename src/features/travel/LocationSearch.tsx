import { useEffect, useId, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import type { Locale, Location } from '../../types/domain';
import { translator } from '../../lib/i18n';
import { api, errorText } from '../../lib/api';
export const locationName = (location: Location, locale: Locale) =>
  locale === 'zh-CN' ? location.name_zh || location.name : location.name;
export default function LocationSearch({
  locale,
  selected,
  onSelect,
}: {
  locale: Locale;
  selected: Location | null;
  onSelect: (location: Location) => void;
}) {
  const t = translator(locale),
    [query, setQuery] = useState(''),
    [items, setItems] = useState<Location[]>([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(''),
    id = useId();
  useEffect(() => {
    if (!query.trim()) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timeout = setTimeout(() => {
      api<{ items: Location[] }>(`/api/locations?q=${encodeURIComponent(query)}`, {
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
  }, [query, locale]);
  return (
    <div>
      <label className="field" htmlFor={id}>
        <span>{t('travel.location')}</span>
      </label>
      {selected && (
        <div className="selected-location">
          <MapPin size={16} />
          <strong>{locationName(selected, locale)}</strong>
          <span className="muted small">
            {locale === 'zh-CN'
              ? selected.country_name_zh || selected.country_name
              : selected.country_name}
          </span>
        </div>
      )}
      <label className="search-field">
        <Search size={17} />
        <input
          id={id}
          placeholder={t('travel.searchLocation')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
        />
      </label>
      {error && (
        <p role="alert" className="form-message error">
          {error}
        </p>
      )}
      {query && (
        <div className="location-results" aria-live="polite">
          {loading ? (
            <p className="small muted">{t('common.loading')}</p>
          ) : items.length ? (
            items.map((item) => (
              <button
                type="button"
                key={item.spot_id ?? item.id}
                onClick={() => {
                  onSelect(item);
                  setQuery('');
                  setItems([]);
                }}
              >
                <MapPin size={16} />
                <span>
                  <strong>{locationName(item, locale)}</strong>
                  <small>
                    {item.region && item.kind === 'city' ? `${item.region} · ` : ''}
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
