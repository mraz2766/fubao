import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { ImagePlus, ArrowLeft, ArrowRight, Trash2 } from 'lucide-react';
import type { Locale, Location, Trip, TravelPhoto } from '../../types/domain';
import { translator } from '../../lib/i18n';
import { api, errorText } from '../../lib/api';
import { tripSchema } from '../../lib/schemas';
import { photoAccept, photoLimits } from '../../lib/photo-policy';
import { useUnsaved } from '../../lib/use-unsaved';
import { queueSaveFeedback } from '../../lib/feedback';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import LocationSearch, { locationName } from './LocationSearch';
import { preparePhoto, uploadPrepared, type PreparedPhoto, type PhotoSuggestion } from './photos';
interface EditorPhoto {
  id: string;
  preview: string;
  name?: string;
  source?: File;
  stage: 'queued' | 'processing' | 'uploading' | 'ready' | 'error';
  uploaded?: TravelPhoto;
  prepared?: PreparedPhoto;
  progress: number;
  error?: string;
}
export default function TravelEditor({
  locale,
  initial,
  onClose,
}: {
  locale: Locale;
  initial?: Trip;
  onClose: () => void;
}) {
  const t = translator(locale),
    [id] = useState(() => initial?.id ?? crypto.randomUUID()),
    [place, setPlace] = useState<Location | null>(initial?.location ?? null),
    [placeName, setPlaceName] = useState(initial?.place_name ?? ''),
    [start, setStart] = useState(initial?.start_date ?? ''),
    [end, setEnd] = useState(initial?.end_date ?? ''),
    [description, setDescription] = useState(initial?.description ?? ''),
    [tags, setTags] = useState(initial?.tags.join(', ') ?? ''),
    [rating, setRating] = useState(initial?.rating ?? 0),
    [visibility, setVisibility] = useState<Trip['visibility']>(initial?.visibility ?? 'private');
  const [photos, setPhotos] = useState<EditorPhoto[]>(
      () =>
        initial?.photos.map((p) => ({
          id: p.id,
          preview: `/api/media/${p.id}/thumbnail`,
          uploaded: p,
          progress: 100,
          stage: 'ready',
        })) ?? [],
    ),
    [pending, setPending] = useState(false),
    [processing, setProcessing] = useState(false),
    [dirty, setDirty] = useState(false),
    [error, setError] = useState(''),
    [suggestion, setSuggestion] = useState<(PhotoSuggestion & { location?: Location }) | null>(
      null,
    );
  useEffect(() => {
    const spot = new URLSearchParams(location.search).get('spot');
    if (!initial && spot)
      api<{ items: Location[] }>(`/api/locations?spot=${encodeURIComponent(spot)}`)
        .then((r) => setPlace(r.items[0]))
        .catch((e) => setError(errorText(e, locale)));
  }, []);
  const previews = useRef<string[]>([]);
  const processingLock = useRef(false);
  useEffect(() => () => previews.current.forEach(URL.revokeObjectURL), []);
  const allowNavigation = useUnsaved(dirty);
  const mark = () => setDirty(true);
  function close() {
    if (!pending && !processing && (!dirty || confirm(t('common.unsaved')))) onClose();
  }
  const patchPhoto = (photoId: string, patch: Partial<EditorPhoto>) =>
    setPhotos((items) => items.map((p) => (p.id === photoId ? { ...p, ...patch } : p)));
  async function upload(photo: PreparedPhoto) {
    patchPhoto(photo.id, { error: undefined, progress: 0, stage: 'uploading' });
    try {
      const result = await uploadPrepared(photo, id, (percent) =>
        patchPhoto(photo.id, { progress: percent }),
      );
      patchPhoto(photo.id, {
        uploaded: result,
        progress: 100,
        stage: 'ready',
        source: undefined,
        prepared: undefined,
      });
    } catch (e) {
      patchPhoto(photo.id, { error: errorText(e, locale), stage: 'error' });
    }
  }
  async function processPhoto(photo: EditorPhoto) {
    try {
      let prepared = photo.prepared;
      if (!prepared && photo.source) {
        patchPhoto(photo.id, { error: undefined, stage: 'processing' });
        prepared = await preparePhoto(photo.source, photo.id);
        previews.current.push(prepared.preview);
        patchPhoto(photo.id, { preview: prepared.preview, prepared });
      }
      if (!prepared) return;
      const metadata = prepared.metadata;
      if (metadata.date || metadata.latitude !== undefined) {
        // Suggestions never postpone uploading. Resolve independently of the file queue.
        setSuggestion(metadata);
        if (metadata.latitude !== undefined && metadata.longitude !== undefined) {
          void api<{ items: Location[] }>(
            `/api/locations/nearby?lat=${metadata.latitude}&lng=${metadata.longitude}`,
          )
            .then((r) =>
              setSuggestion((current) =>
                current?.latitude === metadata.latitude && current?.longitude === metadata.longitude
                  ? { ...current, location: r.items[0] }
                  : current,
              ),
            )
            .catch(() => {});
        }
      }
      await upload(prepared);
    } catch (e) {
      patchPhoto(photo.id, { error: errorText(e, locale), stage: 'error' });
    }
  }
  async function addFiles(files: FileList | File[]) {
    if (processingLock.current || pending || files.length === 0) return;
    if (photos.length + files.length > photoLimits.count) {
      setError(t('error.PHOTO_COUNT'));
      return;
    }
    processingLock.current = true;
    setProcessing(true);
    setError('');
    mark();
    const additions: EditorPhoto[] = Array.from(files, (file) => ({
      id: crypto.randomUUID(),
      preview: '',
      name: file.name,
      source: file,
      progress: 0,
      stage: 'queued',
    }));
    setPhotos((items) => [...items, ...additions]);
    try {
      for (const photo of additions) await processPhoto(photo);
    } finally {
      processingLock.current = false;
      setProcessing(false);
    }
  }
  async function retryPhoto(photo: EditorPhoto) {
    if (processingLock.current || pending) return;
    processingLock.current = true;
    setProcessing(true);
    try {
      await processPhoto(photo);
    } finally {
      processingLock.current = false;
      setProcessing(false);
    }
  }
  function move(index: number, direction: number) {
    const next = [...photos],
      target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setPhotos(next);
    mark();
  }
  async function save(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const input = {
      id,
      location_id: place?.id,
      spot_id: place?.spot_id ?? null,
      place_name: placeName,
      start_date: start || null,
      end_date: end || null,
      description,
      tags: tags
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean),
      rating: rating || null,
      visibility,
      photo_ids: photos.filter((p) => p.uploaded).map((p) => p.id),
      updated_at: initial?.updated_at,
    };
    if (photos.some((p) => !p.uploaded) || !tripSchema.safeParse(input).success) {
      setError(t('error.INVALID_INPUT'));
      return;
    }
    setPending(true);
    setError('');
    try {
      const saved = await api<Trip>('/api/travel/entries', { method: 'POST', body: input });
      setDirty(false);
      allowNavigation();
      queueSaveFeedback('travel', saved.id);
      location.assign(`/travel/${saved.id}`);
    } catch (e) {
      setError(errorText(e, locale));
    } finally {
      setPending(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => !open && close()}
      title={initial ? t('common.edit') : t('travel.add')}
      locale={locale}
      wide
    >
      <form className="form" onSubmit={save}>
        <LocationSearch
          locale={locale}
          selected={place}
          onSelect={(p) => {
            setPlace(p);
            mark();
          }}
        />
        <div>
          <h3>{t('travel.photoLabel')}</h3>
          <label
            className="photo-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
          >
            <ImagePlus size={26} strokeWidth={1.3} />
            <span>{processing ? t('travel.processing') : t('travel.photoHint')}</span>
            <input
              type="file"
              multiple
              accept={photoAccept}
              disabled={pending || processing || photos.length >= photoLimits.count}
              onChange={(e) => {
                if (e.target.files) addFiles(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
          <div className="upload-grid">
            {photos.map((p, i) => (
              <div className="upload-photo" key={p.id}>
                {p.preview ? (
                  <img
                    src={p.preview}
                    alt={p.name || `${t('travel.photoLabel')} ${i + 1}`}
                    width="160"
                    height="120"
                  />
                ) : (
                  <div className="upload-placeholder" aria-hidden="true">
                    <ImagePlus size={24} />
                  </div>
                )}
                {p.name && (
                  <p className="upload-filename small" title={p.name}>
                    {p.name}
                  </p>
                )}
                <div className="upload-controls">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t('common.up')}
                    disabled={pending || processing || i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ArrowLeft size={15} />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t('common.down')}
                    disabled={pending || processing || i === photos.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ArrowRight size={15} />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={t('travel.photoRemove')}
                    disabled={pending || processing}
                    onClick={() => {
                      if (p.preview.startsWith('blob:')) {
                        URL.revokeObjectURL(p.preview);
                        previews.current = previews.current.filter((url) => url !== p.preview);
                      }
                      setPhotos((items) => items.filter((x) => x.id !== p.id));
                      setError('');
                      mark();
                    }}
                  >
                    <Trash2 size={15} />
                  </Button>
                </div>
                {!p.uploaded && !p.error && (
                  <p className="small muted" role="status">
                    {p.stage === 'queued'
                      ? t('travel.queued')
                      : p.stage === 'processing'
                        ? t('travel.processing')
                        : `${t('travel.uploading')} ${p.progress}%`}
                  </p>
                )}
                {p.error && (
                  <div>
                    <p className="form-message error" role="alert">
                      {p.error}
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending || processing}
                      onClick={() => void retryPhoto(p)}
                    >
                      {t('common.retry')}
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        {suggestion && (suggestion.date || suggestion.location) && (
          <div className="suggestion">
            <h3>{t('travel.suggestion')}</h3>
            <p className="small muted">
              {suggestion.location ? locationName(suggestion.location, locale) : ''}{' '}
              {suggestion.date}
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (suggestion.location) setPlace(suggestion.location);
                if (suggestion.date) setStart(suggestion.date);
                setSuggestion(null);
                mark();
              }}
            >
              {t('travel.applySuggestion')}
            </Button>
          </div>
        )}
        <div className="form-row">
          <label className="field">
            <span>{t('travel.start')}</span>
            <input
              type="date"
              value={start}
              onChange={(e) => {
                setStart(e.target.value);
                mark();
              }}
            />
          </label>
          <label className="field">
            <span>{t('travel.end')}</span>
            <input
              type="date"
              value={end}
              min={start}
              onChange={(e) => {
                setEnd(e.target.value);
                mark();
              }}
            />
          </label>
        </div>
        <details className="form-details">
          <summary>{t('quiet.details')}</summary>
          <label className="field">
            <span>{t('travel.customPlace')}</span>
            <input
              value={placeName}
              maxLength={120}
              placeholder={t('travel.customPlaceHint')}
              onChange={(e) => {
                setPlaceName(e.target.value);
                mark();
              }}
            />
          </label>
          <label className="field">
            <span>{t('travel.description')}</span>
            <textarea
              value={description}
              maxLength={10000}
              onChange={(e) => {
                setDescription(e.target.value);
                mark();
              }}
            />
          </label>
          <label className="field">
            <span>{t('travel.tags')}</span>
            <input
              value={tags}
              maxLength={800}
              onChange={(e) => {
                setTags(e.target.value);
                mark();
              }}
            />
          </label>
          <div className="form-row">
            <label className="field">
              <span>{t('travel.rating')}</span>
              <select
                value={rating}
                onChange={(e) => {
                  setRating(Number(e.target.value));
                  mark();
                }}
              >
                <option value={0}>{t('common.optional')}</option>
                {[1, 2, 3, 4, 5].map((v) => (
                  <option value={v} key={v}>
                    {'★'.repeat(v)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t('common.visibility')}</span>
              <select
                value={visibility}
                onChange={(e) => {
                  setVisibility(e.target.value as Trip['visibility']);
                  mark();
                }}
              >
                <option value="private">{t('common.private')}</option>
                <option value="public">{t('common.public')}</option>
              </select>
            </label>
          </div>
        </details>
        {error && (
          <p className="form-message error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <Button type="button" variant="ghost" disabled={pending || processing} onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={
              pending ||
              processing ||
              !place ||
              photos.length < 1 ||
              photos.some((p) => !p.uploaded)
            }
          >
            {pending ? t('common.saving') : t('common.save')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
