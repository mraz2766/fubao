import { useState } from 'react';
import { ArrowUpRight, Heart, MapPin, Search, Camera, Check } from 'lucide-react';
import destinations from '../../data/scenic-spots.json';
import type { Locale, Location, Wish } from '../../types/domain';
import { translator, type TranslationKey } from '../../lib/i18n';
import { api, errorText } from '../../lib/api';
import { Chip } from '../../components/ui/chip';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
export default function Discover({
  locale,
  owner,
  initialWishes,
  selectedId,
  visitedIds = [],
}: {
  locale: Locale;
  owner: boolean;
  initialWishes: Wish[];
  selectedId?: string;
  visitedIds?: string[];
}) {
  const t = translator(locale),
    [query, setQuery] = useState(''),
    [region, setRegion] = useState(''),
    [category, setCategory] = useState('all'),
    [status, setStatus] = useState('all');
  const [selected, setSelected] = useState(destinations.find((d) => d.id === selectedId) ?? null);
  const [wishes, setWishes] = useState(initialWishes),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  const name = (d: (typeof destinations)[number]) => (locale === 'zh-CN' ? d.name_zh : d.name_en);
  const items = destinations.filter(
    (d) =>
      (status === 'all' ||
        (status === 'visited'
          ? visitedIds.includes(d.id)
          : wishes.some((w) => w.spot_id === d.id))) &&
      (!region || d.region === region) &&
      (category === 'all' || d.category === category) &&
      `${d.name_zh} ${d.name_en} ${d.region} ${d.region_en}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function toggleWish() {
    if (!selected) return;
    const existing = wishes.find((w) => w.spot_id === selected.id);
    if (existing && !confirm(t('common.confirmDelete'))) return;
    setPending(true);
    setError('');
    try {
      if (existing) await api(`/api/travel/wishlist/${existing.id}`, { method: 'DELETE' });
      else {
        const { items } = await api<{ items: Location[] }>(`/api/locations?spot=${selected.id}`);
        await api('/api/travel/wishlist', {
          method: 'POST',
          body: {
            id: crypto.randomUUID(),
            location_id: items[0].id,
            spot_id: selected.id,
            visibility: 'private',
          },
        });
      }
      setWishes((await api<{ items: Wish[] }>('/api/travel/wishlist')).items);
    } catch (e) {
      setError(errorText(e, locale));
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="discovery">
      <div className="discovery-heading">
        <div>
          <h2>{t('travel.discoverTitle')}</h2>
        </div>
      </div>
      <div className="discovery-filters">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label={t('travel.searchSpot')}
            placeholder={t('travel.searchSpot')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <details className="filter-panel">
        <summary>{t('quiet.filters')}</summary>
        <div className="discovery-toolbar">
          <div className="segmented" aria-label={t('travel.collection')}>
            {(['all', 'wanted', 'visited'] as const).map((value) => (
              <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>
                {t(`travel.collection.${value}`)}
              </button>
            ))}
          </div>
          <span className="small muted" aria-live="polite">
            {items.length} {t('travel.destinations')}
          </span>
        </div>
        <label className="field">
          <span className="sr-only">{t('travel.region')}</span>
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">{t('travel.allRegions')}</option>
            {[...new Set(destinations.map((d) => d.region))].map((r) => (
              <option key={r} value={r}>
                {locale === 'zh-CN' ? r : destinations.find((d) => d.region === r)?.region_en}
              </option>
            ))}
          </select>
        </label>
        <div className="part-options scenic-filters">
          {['all', 'landscape', 'mountains', 'lakes', 'heritage'].map((c) => (
            <button
              key={c}
              className={`chip ${category === c ? 'active' : ''}`}
              aria-pressed={category === c}
              onClick={() => setCategory(c)}
            >
              {t(`travel.category.${c}` as TranslationKey)}
            </button>
          ))}
        </div>
      </details>
      {items.length ? (
        <div className="destination-grid">
          {items.map((d, i) => (
            <article
              className={`destination-card ${i === 0 && !query && !region && category === 'all' ? 'destination-featured' : ''}`}
              key={d.id}
            >
              <button
                className="destination-photo"
                onClick={() => {
                  setSelected(d);
                  setError('');
                }}
                aria-label={name(d)}
              >
                <img
                  src={d.image.thumbnail}
                  sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 45vw"
                  alt={name(d)}
                  width={d.image.width}
                  height={d.image.height}
                  loading={i < 2 ? 'eager' : 'lazy'}
                />
                <Chip className="destination-category">
                  {t(`travel.category.${d.category}` as TranslationKey)}
                </Chip>
                <span className="destination-arrow">
                  <ArrowUpRight size={20} />
                </span>
                {(visitedIds.includes(d.id) || wishes.some((w) => w.spot_id === d.id)) && (
                  <span className="destination-saved">
                    {visitedIds.includes(d.id) ? (
                      <Check size={14} />
                    ) : (
                      <Heart size={14} fill="currentColor" />
                    )}
                    {t(visitedIds.includes(d.id) ? 'travel.visited' : 'travel.want')}
                  </span>
                )}
              </button>
              <div className="destination-caption">
                <div>
                  <span className="eyebrow">{locale === 'zh-CN' ? d.region : d.region_en}</span>
                  <h3>
                    <button
                      onClick={() => {
                        setSelected(d);
                        setError('');
                      }}
                    >
                      {name(d)}
                    </button>
                  </h3>
                </div>
                <p>{locale === 'zh-CN' ? d.description_zh : d.description_en}</p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="empty">{t('travel.noLocations')}</p>
      )}
      <p className="footer-note">
        {t('travel.scenicAttribution')}{' '}
        <a href="/about#scenery" className="text-link">
          {t('settings.sources')} <ArrowUpRight size={13} />
        </a>
      </p>
      <Dialog
        open={!!selected}
        onOpenChange={(open) => !pending && !open && setSelected(null)}
        title={selected ? name(selected) : ''}
        locale={locale}
        wide
      >
        {selected && (
          <div className="destination-detail">
            <img
              className="destination-detail-photo"
              src={selected.image.src}
              alt={name(selected)}
              width={selected.image.width}
              height={selected.image.height}
            />
            <p className="eyebrow">
              <MapPin size={14} />
              {locale === 'zh-CN' ? selected.region : selected.region_en} ·{' '}
              {t(`travel.category.${selected.category}` as TranslationKey)}
            </p>
            <p>{locale === 'zh-CN' ? selected.description_zh : selected.description_en}</p>
            <p className="muted small">{t('travel.scenicDetailHint')}</p>
            {error && (
              <p className="form-message error" role="alert">
                {error}
              </p>
            )}
            <div className="form-actions">
              {owner ? (
                <>
                  <Button variant="secondary" disabled={pending} onClick={toggleWish}>
                    {wishes.some((w) => w.spot_id === selected.id) ? (
                      <Check size={16} />
                    ) : (
                      <Heart size={16} />
                    )}{' '}
                    {pending
                      ? t('common.saving')
                      : wishes.some((w) => w.spot_id === selected.id)
                        ? t('travel.savedWish')
                        : t('travel.addWish')}
                  </Button>
                  <a
                    className="button button-primary"
                    href={`/travel?view=timeline&new=1&spot=${selected.id}`}
                  >
                    <Camera size={16} />
                    {t('travel.recordHere')}
                  </a>
                </>
              ) : (
                <a className="button button-primary" href="/login">
                  {t('auth.login')}
                </a>
              )}
            </div>
            <p className="photo-credit">
              © {selected.image.artist} ·{' '}
              <a href={selected.image.source} target="_blank" rel="noreferrer">
                Wikimedia Commons
              </a>{' '}
              ·{' '}
              <a href={selected.image.licenseUrl} target="_blank" rel="noreferrer">
                {selected.image.license}
              </a>{' '}
              · {t('travel.imageAdapted')}
            </p>
          </div>
        )}
      </Dialog>
    </section>
  );
}
