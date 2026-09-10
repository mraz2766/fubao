import { useState } from 'react';
import { Plus, Trash2, MapPin } from 'lucide-react';
import type { Locale, Location, Wish } from '../../types/domain';
import { translator } from '../../lib/i18n';
import { useUnsaved } from '../../lib/use-unsaved';
import { api, errorText } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import LocationSearch, { locationName } from './LocationSearch';
export default function Wishlist({
  locale,
  initial,
  owner,
}: {
  locale: Locale;
  initial: Wish[];
  owner: boolean;
}) {
  const t = translator(locale),
    [items, setItems] = useState(initial),
    [open, setOpen] = useState(false),
    [place, setPlace] = useState<Location | null>(null),
    [visibility, setVisibility] = useState<Wish['visibility']>('private'),
    [pending, setPending] = useState(false),
    [error, setError] = useState('');
  useUnsaved(open && !!place);
  function changeOpen(value: boolean) {
    if (pending) return;
    if (!value && place && !confirm(t('common.unsaved'))) return;
    setOpen(value);
    if (!value) setPlace(null);
  }
  async function save() {
    if (!place) return;
    setPending(true);
    try {
      await api('/api/travel/wishlist', {
        method: 'POST',
        body: {
          id: crypto.randomUUID(),
          location_id: place.id,
          spot_id: place.spot_id ?? null,
          visibility,
        },
      });
      setItems((await api<{ items: Wish[] }>('/api/travel/wishlist')).items);
      setOpen(false);
      setPlace(null);
    } catch (e) {
      setError(errorText(e, locale));
    } finally {
      setPending(false);
    }
  }
  async function remove(id: string) {
    if (!confirm(t('common.confirmDelete'))) return;
    try {
      await api(`/api/travel/wishlist/${id}`, { method: 'DELETE' });
      setItems(items.filter((x) => x.id !== id));
    } catch (e) {
      setError(errorText(e, locale));
    }
  }
  return (
    <>
      <div className="card-heading">
        <h2>{t('travel.wishlist')}</h2>
        {owner && (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Plus size={16} />
            {t('travel.addWish')}
          </Button>
        )}
      </div>
      {error && (
        <p className="form-message error" role="alert">
          {error}
        </p>
      )}
      {items.length ? (
        items.map((w) => (
          <div key={w.id} className="recent-row">
            <span className="recent-icon">
              <MapPin size={20} />
            </span>
            <div className="recent-info">
              <h3>{locationName(w.location, locale)}</h3>
              <p className="small muted">
                {w.location.country_name} {owner ? `· ${t(`common.${w.visibility}`)}` : ''}
              </p>
            </div>
            {owner && (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('common.delete')}
                onClick={() => remove(w.id)}
              >
                <Trash2 size={16} />
              </Button>
            )}
          </div>
        ))
      ) : (
        <p className="empty">{t('travel.noWish')}</p>
      )}
      <Dialog open={open} onOpenChange={changeOpen} title={t('travel.addWish')} locale={locale}>
        <div className="form">
          <LocationSearch locale={locale} selected={place} onSelect={setPlace} />
          <label className="field">
            <span>{t('common.visibility')}</span>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Wish['visibility'])}
            >
              <option value="private">{t('common.private')}</option>
              <option value="public">{t('common.public')}</option>
            </select>
          </label>
          {error && (
            <p role="alert" className="form-message error">
              {error}
            </p>
          )}
          <Button disabled={!place || pending} onClick={save}>
            {pending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
