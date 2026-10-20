import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Clock, LocateFixed, MapPin, Mountain, PenLine, Search } from 'lucide-react';
import { Sheet } from '../core/ui';
import { useApp } from '../core/app-state';
import { useQuery } from '../core/query';
import { api } from '../../lib/api';
import { t, zh } from '../core/i18n';
import { flag, placeContext, placeName } from '../core/format';
import { keys, manualLocation, spots, type Location } from './data';

const kindLabel = (l: Location) =>
  l.spot_id
    ? t('景点', 'Spot')
    : l.kind === 'city'
      ? t('城市', 'City')
      : l.kind === 'region'
        ? t('省/州', 'Region')
        : t('国家', 'Country');

export function PlacePicker({
  open,
  onClose,
  onPick,
  title,
  allowManual = true,
  suggestions = [],
}: {
  open: boolean;
  onClose: () => void;
  onPick: (loc: Location) => void;
  title?: string;
  allowManual?: boolean;
  suggestions?: Location[];
}) {
  const { owner } = useApp();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const { data: recent } = useQuery<{ items: Location[] }>(open && owner ? keys.recent : null);

  useEffect(() => {
    if (open) setQ('');
  }, [open]);
  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults([]);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, limit: '20' });
        if (zh()) params.set('preferCountry', 'CN');
        const { items } = await api<{ items: Location[] }>(`/api/locations?${params}`);
        if (id === seq.current) setResults(items);
      } catch {
        if (id === seq.current) setResults([]);
      } finally {
        if (id === seq.current) setLoading(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [q]);

  const pick = (l: Location) => {
    onPick(l);
    onClose();
  };
  const row = (l: Location, icon: React.ReactNode, i: number) => (
    <motion.button
      key={`${l.id}-${l.spot_id ?? ''}-${i}`}
      className="list-row tappable place-row"
      onClick={() => pick(l)}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(i, 10) * 0.02 }}
    >
      <span className="place-ic">{icon}</span>
      <span className="grow">
        <span className="place-name ellipsis">{placeName(l)}</span>
        <span className="faint small ellipsis" style={{ display: 'block' }}>
          {flag(l.country_code)} {placeContext(l) || kindLabel(l)}
        </span>
      </span>
      <span className="badge">{kindLabel(l)}</span>
    </motion.button>
  );
  const featured = spots.slice(0, 6);
  return (
    <Sheet open={open} onClose={onClose} full title={title ?? t('选择地点', 'Choose a place')}>
      <div className="picker-top">
        <label className="search">
          <Search />
          <input
            className="input"
            type="search"
            enterKeyHint="search"
            placeholder={t('城市、国家或景点', 'City, country or spot')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>
      {q.trim() ? (
        <>
          <div className="list">
            {results.map((l, i) => row(l, l.spot_id ? <Mountain /> : <MapPin />, i))}
            {allowManual && (
              <button
                className="list-row tappable place-row"
                onClick={() => pick(manualLocation(q.trim().slice(0, 120)))}
              >
                <span className="place-ic manual">
                  <PenLine />
                </span>
                <span className="grow">
                  <span className="place-name ellipsis">
                    {t(`使用「${q.trim()}」`, `Use “${q.trim()}”`)}
                  </span>
                  <span className="faint small">
                    {t('自定义地点，不计入地图统计', 'Custom place, not on the map')}
                  </span>
                </span>
              </button>
            )}
          </div>
          {loading && !results.length && (
            <div style={{ display: 'grid', placeItems: 'center', padding: 20 }}>
              <span className="spinner" />
            </div>
          )}
          {!loading && !results.length && (
            <p className="faint small" style={{ padding: 16, textAlign: 'center' }}>
              {t('没有找到匹配的地点', 'No matching places')}
            </p>
          )}
        </>
      ) : (
        <>
          {!!suggestions.length && (
            <>
              <div className="list-label">{t('照片拍摄地附近', 'Near your photos')}</div>
              <div className="list" style={{ marginBottom: 18 }}>
                {suggestions.map((l, i) => row(l, <LocateFixed />, i))}
              </div>
            </>
          )}
          {!!recent?.items.length && (
            <>
              <div className="list-label">{t('最近', 'Recent')}</div>
              <div className="list" style={{ marginBottom: 18 }}>
                {recent.items.map((l, i) => row(l, <Clock />, i))}
              </div>
            </>
          )}
          <div className="list-label">{t('热门景点', 'Popular spots')}</div>
          <div className="list">
            {featured.map((s, i) => (
              <motion.button
                key={s.id}
                className="list-row tappable place-row"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.03 }}
                onClick={async () => {
                  const { items } = await api<{ items: Location[] }>(`/api/locations?spot=${s.id}`);
                  if (items[0]) pick(items[0]);
                }}
              >
                <img className="place-img" src={s.image.thumbnail} alt="" />
                <span className="grow">
                  <span className="place-name ellipsis">{zh() ? s.name_zh : s.name_en}</span>
                  <span className="faint small">{zh() ? s.region : s.region_en}</span>
                </span>
                <span className="badge">{t('景点', 'Spot')}</span>
              </motion.button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
