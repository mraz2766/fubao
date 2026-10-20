import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronRight,
  ImagePlus,
  LocateFixed,
  MapPin,
  RotateCcw,
  Star,
  X,
  CalendarDays,
} from 'lucide-react';
import { Sheet, Press, Switch, ConfirmSheet, spring } from '../core/ui';
import { useApp } from '../core/app-state';
import { t, errorMessage } from '../core/i18n';
import { fmtDate, flag, photoUrl, placeContext, placeName } from '../core/format';
import { api } from '../../lib/api';
import { photoAccept, photoLimits } from '../../lib/photo-policy';
import type { TravelPhoto } from '../../types/domain';
import { preparePhoto, uploadPrepared, type PreparedPhoto, type PhotoSuggestion } from './photos';
import { PlacePicker } from './PlacePicker';
import { saveTrip, type Location, type Trip } from './data';

interface Item {
  id: string;
  preview: string;
  status: 'queued' | 'processing' | 'uploading' | 'done' | 'error';
  progress: number;
  file?: File;
  prepared?: PreparedPhoto;
  photo?: TravelPhoto;
  error?: string;
  metadata?: PhotoSuggestion;
}

export function TripEditor({
  open,
  onClose,
  onSaved,
  trip,
  initialLocation,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (trip: Trip) => void;
  trip?: Trip | null;
  initialLocation?: Location | null;
}) {
  const { toast } = useApp();
  const [tripId, setTripId] = useState('');
  const [location, setLocation] = useState<Location | null>(null);
  const [customName, setCustomName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [note, setNote] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [pub, setPub] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [picker, setPicker] = useState(false);
  const [nearby, setNearby] = useState<Location[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [dirty, setDirty] = useState(false);
  const datesTouched = useRef(false);
  const itemsRef = useRef<Item[]>([]);
  itemsRef.current = items;
  const abort = useRef<AbortController | null>(null);
  const running = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    abort.current = new AbortController();
    setTripId(trip?.id ?? crypto.randomUUID());
    const loc = trip?.location ?? initialLocation ?? null;
    setLocation(
      trip && trip.location_id === 'manual-place'
        ? { ...trip.location, name: trip.place_name ?? '', name_zh: trip.place_name ?? '' }
        : loc,
    );
    setCustomName(trip && trip.location_id !== 'manual-place' ? (trip.place_name ?? '') : '');
    setStart(trip?.start_date ?? '');
    setEnd(trip?.end_date ?? '');
    setNote(trip?.description ?? '');
    setRating(trip?.rating ?? null);
    setPub(trip?.visibility === 'public');
    setItems(
      (trip?.photos ?? []).map((p) => ({
        id: p.id,
        preview: photoUrl(p.id),
        status: 'done',
        progress: 100,
        photo: p,
      })),
    );
    setNearby([]);
    setDirty(false);
    setSaving(false);
    datesTouched.current = !!trip?.start_date;
    return () => {
      abort.current?.abort();
      for (const item of itemsRef.current)
        if (item.preview.startsWith('blob:')) URL.revokeObjectURL(item.preview);
    };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (id: string, p: Partial<Item>) =>
    setItems((list) => list.map((x) => (x.id === id ? { ...x, ...p } : x)));

  async function pump() {
    if (running.current) return;
    running.current = true;
    try {
      for (;;) {
        const next = itemsRef.current.find((x) => x.status === 'queued');
        if (!next || abort.current?.signal.aborted) break;
        try {
          let prepared = next.prepared;
          if (!prepared) {
            patch(next.id, { status: 'processing', error: undefined });
            prepared = await preparePhoto(next.file!, next.id);
            patch(next.id, { prepared, preview: prepared.preview, metadata: prepared.metadata });
            applyMetadata(prepared.metadata);
          }
          patch(next.id, { status: 'uploading', progress: 0 });
          const photo = await uploadPrepared(
            prepared,
            tripId,
            (progress) => patch(next.id, { progress }),
            abort.current?.signal,
          );
          patch(next.id, { status: 'done', progress: 100, photo });
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') break;
          patch(next.id, { status: 'error', error: errorMessage(error) });
        }
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      running.current = false;
    }
  }
  useEffect(() => {
    if (items.some((x) => x.status === 'queued')) void pump();
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const metaDates = useRef<string[]>([]);
  function applyMetadata(meta: PhotoSuggestion) {
    if (meta.date && !datesTouched.current) {
      metaDates.current = [...metaDates.current, meta.date].sort();
      setStart(metaDates.current[0]!);
      setEnd(
        metaDates.current.length > 1 && metaDates.current.at(-1) !== metaDates.current[0]
          ? metaDates.current.at(-1)!
          : '',
      );
    }
    if (meta.latitude !== undefined && meta.longitude !== undefined && !nearbyLoaded.current) {
      nearbyLoaded.current = true;
      void api<{ items: Location[] }>(
        `/api/locations/nearby?lat=${meta.latitude}&lng=${meta.longitude}`,
      )
        .then((r) => setNearby(r.items))
        .catch(() => {});
    }
  }
  const nearbyLoaded = useRef(false);
  useEffect(() => {
    if (open) {
      nearbyLoaded.current = false;
      metaDates.current = [];
    }
  }, [open]);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const room = photoLimits.count - items.length;
    if (files.length > room)
      toast(
        t(
          `最多 6 张，已添加前 ${Math.max(room, 0)} 张`,
          `Up to 6 photos; added ${Math.max(room, 0)}`,
        ),
        'error',
      );
    const added = [...files].slice(0, Math.max(0, room)).map<Item>((file) => ({
      id: crypto.randomUUID(),
      preview: '',
      status: 'queued',
      progress: 0,
      file,
    }));
    setItems((list) => [...list, ...added]);
    setDirty(true);
  };
  const remove = (id: string) => {
    setItems((list) => list.filter((x) => x.id !== id));
    setDirty(true);
  };
  const makeCover = (id: string) => {
    setItems((list) => {
      const item = list.find((x) => x.id === id);
      return item ? [item, ...list.filter((x) => x.id !== id)] : list;
    });
    setDirty(true);
  };

  const done = items.filter((x) => x.status === 'done');
  const busy = items.some((x) => ['queued', 'processing', 'uploading'].includes(x.status));
  const canSave =
    !!location && done.length > 0 && !busy && !saving && (!end || !start || end >= start);
  const close = () => (dirty || busy ? setConfirmClose(true) : onClose());

  async function save() {
    if (!location || !canSave) return;
    setSaving(true);
    try {
      const manual = location.id === 'manual-place';
      const saved = await saveTrip({
        id: tripId,
        location_id: location.id,
        spot_id: location.spot_id ?? null,
        place_name: manual ? location.name : customName.trim(),
        start_date: start || null,
        end_date: start && end && end !== start ? end : null,
        description: note,
        tags: trip?.tags ?? [],
        rating,
        visibility: pub ? 'public' : 'private',
        photo_ids: items.filter((x) => x.status === 'done').map((x) => x.photo!.id),
        updated_at: trip?.updated_at,
      });
      toast(trip ? t('已保存', 'Saved') : t('旅程已收藏', 'Trip saved'));
      onClose();
      onSaved(saved);
    } catch (error) {
      toast(errorMessage(error), 'error');
      setSaving(false);
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={close}
        full
        wide
        title={trip ? t('编辑旅程', 'Edit trip') : t('记录一段旅程', 'New trip')}
        footer={
          <Press className="btn btn-trav block lg" disabled={!canSave} onClick={save}>
            {saving ? (
              <span className="spinner" />
            ) : busy ? (
              t('照片上传中…', 'Uploading photos…')
            ) : !done.length ? (
              t('至少添加 1 张照片', 'Add at least 1 photo')
            ) : !location ? (
              t('选择地点', 'Choose a place')
            ) : (
              t('保存', 'Save')
            )}
          </Press>
        }
      >
        <div className="photo-grid">
          <AnimatePresence initial={false}>
            {items.map((item, i) => (
              <motion.div
                key={item.id}
                layout
                className={`photo-tile ${item.status}`}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={spring}
              >
                {item.preview ? (
                  <button
                    className="photo-img"
                    onClick={() => i > 0 && item.status === 'done' && makeCover(item.id)}
                    aria-label={t('设为封面', 'Make cover')}
                  >
                    <img src={item.preview} alt="" />
                  </button>
                ) : (
                  <div className="photo-img skeleton" />
                )}
                {i === 0 && item.status === 'done' && (
                  <span className="cover-badge">{t('封面', 'Cover')}</span>
                )}
                {['queued', 'processing', 'uploading'].includes(item.status) && (
                  <div className="photo-progress">
                    <svg viewBox="0 0 40 40" width="40" height="40">
                      <circle
                        cx="20"
                        cy="20"
                        r="16"
                        fill="none"
                        stroke="rgba(255,255,255,0.3)"
                        strokeWidth="4"
                      />
                      <motion.circle
                        cx="20"
                        cy="20"
                        r="16"
                        fill="none"
                        stroke="#fff"
                        strokeWidth="4"
                        strokeLinecap="round"
                        style={{ rotate: -90, transformOrigin: '50% 50%' }}
                        animate={{
                          pathLength:
                            item.status === 'uploading'
                              ? Math.max(0.05, item.progress / 100)
                              : 0.15,
                        }}
                      />
                    </svg>
                    <span>
                      {item.status === 'uploading'
                        ? `${item.progress}%`
                        : t('处理中', 'Optimizing')}
                    </span>
                  </div>
                )}
                {item.status === 'error' && (
                  <button
                    className="photo-error"
                    onClick={() => patch(item.id, { status: 'queued', error: undefined })}
                    title={item.error}
                  >
                    <RotateCcw />
                    <span>{t('重试', 'Retry')}</span>
                  </button>
                )}
                <button
                  className="photo-remove"
                  onClick={() => remove(item.id)}
                  aria-label={t('移除', 'Remove')}
                >
                  <X strokeWidth={3} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {items.length < photoLimits.count && (
            <motion.button layout className="photo-add" onClick={() => fileInput.current?.click()}>
              <ImagePlus />
              <span>{items.length ? t('继续添加', 'Add more') : t('添加照片', 'Add photos')}</span>
              <small>{items.length}/6</small>
            </motion.button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept={photoAccept}
            multiple
            hidden
            onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))}
          />
        </div>
        {items.find((x) => x.status === 'error') && (
          <p className="danger-text small" style={{ marginTop: 8 }}>
            {items.find((x) => x.status === 'error')?.error}
          </p>
        )}
        {items.length > 1 && (
          <p className="faint small" style={{ marginTop: 8 }}>
            {t('轻点照片设为封面', 'Tap a photo to make it the cover')}
          </p>
        )}

        <div className="form-label">{t('地点', 'Place')}</div>
        <div className="list">
          <button className="list-row tappable" onClick={() => setPicker(true)}>
            <span className="row-icon" style={{ background: 'var(--trav-grad)' }}>
              <MapPin />
            </span>
            <span className="grow">
              {location ? (
                <>
                  <span className="place-name ellipsis">{placeName(location)}</span>
                  <span className="faint small ellipsis" style={{ display: 'block' }}>
                    {flag(location.country_code)}{' '}
                    {placeContext(location) || t('自定义地点', 'Custom place')}
                  </span>
                </>
              ) : (
                <span className="faint">
                  {t('选择城市、国家或景点', 'Choose a city, country or spot')}
                </span>
              )}
            </span>
            <ChevronRight className="chev" />
          </button>
          {!location && nearby[0] && (
            <button
              className="list-row tappable"
              onClick={() => (setLocation(nearby[0]!), setDirty(true))}
            >
              <span
                className="row-icon"
                style={{ background: 'var(--surface-3)', color: 'var(--ink)' }}
              >
                <LocateFixed />
              </span>
              <span className="grow">
                {t('照片拍摄于 ', 'Taken near ')}
                <b>{placeName(nearby[0])}</b>
              </span>
              <span className="badge trav">{t('使用', 'Use')}</span>
            </button>
          )}
          {location && location.id !== 'manual-place' && (
            <div className="list-row">
              <input
                className="bare-input"
                value={customName}
                maxLength={120}
                onChange={(e) => (setCustomName(e.target.value), setDirty(true))}
                placeholder={t('具体名称（可选），如 西湖边的小酒馆', 'Specific name (optional)')}
              />
            </div>
          )}
        </div>

        <div className="form-label">{t('日期', 'Dates')}</div>
        <div className="date-pair">
          <label className="date-box">
            <CalendarDays />
            <span className="grow">
              <small>{t('出发', 'From')}</small>
              <b>
                {start
                  ? fmtDate(start, { year: 'numeric', month: 'short', day: 'numeric' })
                  : t('未设置', 'Not set')}
              </b>
            </span>
            <input
              type="date"
              className="overlay-input"
              value={start}
              onChange={(e) => {
                datesTouched.current = true;
                setStart(e.target.value);
                if (end && e.target.value > end) setEnd('');
                setDirty(true);
              }}
            />
          </label>
          <label className={`date-box ${start ? '' : 'disabled'}`}>
            <CalendarDays />
            <span className="grow">
              <small>{t('返回', 'To')}</small>
              <b>
                {end
                  ? fmtDate(end, { year: 'numeric', month: 'short', day: 'numeric' })
                  : t('当天', 'Same day')}
              </b>
            </span>
            <input
              type="date"
              className="overlay-input"
              value={end}
              min={start}
              disabled={!start}
              onChange={(e) => {
                datesTouched.current = true;
                setEnd(e.target.value);
                setDirty(true);
              }}
            />
          </label>
        </div>

        <div className="form-label">{t('评分', 'Rating')}</div>
        <div className="stars">
          {[1, 2, 3, 4, 5].map((n) => (
            <motion.button
              key={n}
              className={`star ${rating && n <= rating ? 'on' : ''}`}
              whileTap={{ scale: 0.7 }}
              animate={rating && n <= rating ? { scale: [1, 1.25, 1] } : { scale: 1 }}
              transition={{ duration: 0.3, delay: rating && n <= rating ? n * 0.04 : 0 }}
              onClick={() => (setRating(rating === n ? null : n), setDirty(true))}
              aria-label={`${n}`}
            >
              <Star />
            </motion.button>
          ))}
        </div>

        <div className="form-label">{t('游记', 'Story')}</div>
        <textarea
          className="textarea"
          value={note}
          maxLength={10000}
          placeholder={t('那天的风、吃过的东西、遇到的人…', 'The weather, the food, the people…')}
          onChange={(e) => (setNote(e.target.value), setDirty(true))}
        />

        <div className="list" style={{ marginTop: 18 }}>
          <div className="list-row">
            <span className="grow">
              {t('公开展示', 'Public')}
              <span className="faint small" style={{ display: 'block' }}>
                {t('访客可以看到这段旅程和照片', 'Visitors can see this trip and photos')}
              </span>
            </span>
            <Switch
              on={pub}
              onChange={(v) => (setPub(v), setDirty(true))}
              label={t('公开展示', 'Public')}
            />
          </div>
        </div>
      </Sheet>
      <PlacePicker
        open={picker}
        onClose={() => setPicker(false)}
        suggestions={nearby}
        onPick={(l) => (setLocation(l), setDirty(true))}
      />
      <ConfirmSheet
        open={confirmClose}
        title={t('放弃这次编辑？', 'Discard changes?')}
        text={busy ? t('照片仍在上传。', 'Photos are still uploading.') : undefined}
        confirm={t('放弃', 'Discard')}
        danger
        onClose={() => setConfirmClose(false)}
        onConfirm={() => {
          setConfirmClose(false);
          onClose();
        }}
      />
    </>
  );
}
