import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import type { Locale, Trip } from '../../types/domain';
import { translator } from '../../lib/i18n';
import { api, errorText } from '../../lib/api';
import { photoAccept } from '../../lib/photo-policy';
const TravelEditor = lazy(() => import('./TravelEditor'));
export default function TravelActions({ locale, trip }: { locale: Locale; trip?: Trip }) {
  const t = translator(locale),
    [open, setOpen] = useState(false),
    [pending, setPending] = useState(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState('');
  const picker = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  useEffect(() => {
    setReady(true);
    if (new URLSearchParams(location.search).get('new') === '1') setOpen(true);
  }, []);
  async function remove() {
    if (!trip || !confirm(t('common.confirmDelete'))) return;
    setPending(true);
    try {
      await api(`/api/travel/entries/${trip.id}`, { method: 'DELETE' });
      location.assign('/travel');
    } catch (e) {
      setError(errorText(e, locale));
      setPending(false);
    }
  }
  return (
    <>
      <div className="form-actions" style={{ padding: 0 }}>
        {trip && (
          <details className="view-menu action-menu">
            <summary aria-label={t('simple.more')}>···</summary>
            <div className="action-menu-content">
              <Button
                variant="ghost"

                aria-label={t('common.delete')}
                disabled={pending}
                onClick={remove}
              >
                <Trash2 size={17} /> {t('common.delete')}
              </Button>
            </div>
          </details>
        )}
        {!trip && !open && (
          <input
            ref={picker}
            hidden
            tabIndex={-1}
            type="file"
            accept={photoAccept}
            multiple
            aria-label={t('flow.selectPhotos')}
            onChange={(e) => {
              const selected = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (selected.length) {
                setFiles(selected);
                setOpen(true);
              }
            }}
          />
        )}
        <Button
          disabled={!ready || pending}
          onClick={() => (trip ? setOpen(true) : picker.current?.click())}
        >
          {trip ? <Pencil size={15} /> : <Plus size={16} />}{' '}
          {trip ? t('common.edit') : t('travel.add')}
        </Button>
      </div>
      {error && (
        <p className="form-message error" role="alert">
          {error}
        </p>
      )}
      {open && (
        <Suspense fallback={<p role="status">{t('common.loading')}</p>}>
          <TravelEditor
            locale={locale}
            initial={trip}
            initialFiles={files}
            onClose={() => {
              setOpen(false);
              setFiles([]);
            }}
          />
        </Suspense>
      )}
    </>
  );
}
