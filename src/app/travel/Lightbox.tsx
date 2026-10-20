import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { animate, motion, useMotionValue, useTransform } from 'motion/react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { TravelPhoto } from '../../types/domain';
import { photoUrl } from '../core/format';
import { t } from '../core/i18n';
import { reducedMotion } from '../core/router';

const ease = [0.32, 0.72, 0, 1] as const;

function fitRect(p: TravelPhoto) {
  const vw = innerWidth,
    vh = innerHeight;
  const scale = Math.min(vw / p.width, vh / p.height);
  const w = p.width * scale,
    h = p.height * scale;
  return { x: (vw - w) / 2, y: (vh - h) / 2, w, h };
}
const thumbRect = (id: string) =>
  document.querySelector<HTMLElement>(`[data-photo="${id}"]`)?.getBoundingClientRect() ?? null;

/** Photos zoom out of their thumbnails, swipe sideways to browse, drag down to dismiss. */
export function Lightbox({
  photos,
  start,
  onClose,
}: {
  photos: TravelPhoto[];
  start: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(start);
  const [width, setWidth] = useState(innerWidth);
  const track = useMotionValue(-start * innerWidth);
  const dy = useMotionValue(0);
  const backdrop = useTransform(dy, [-300, 0, 300], [0.2, 1, 0.2]);
  const dismissScale = useTransform(dy, [-400, 0, 400], [0.7, 1, 0.7]);
  const [chrome, setChrome] = useState(true);
  const [closing, setClosing] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  const fade = useMotionValue(0);
  const fly = { x: useMotionValue(0), y: useMotionValue(0), s: useMotionValue(1) };

  // Opening: fly from the thumbnail into place.
  useEffect(() => {
    const p = photos[start]!;
    const from = thumbRect(p.id);
    const to = fitRect(p);
    animate(fade, 1, { duration: reducedMotion() ? 0 : 0.3 });
    if (from && !reducedMotion()) {
      fly.x.set(from.left + from.width / 2 - (to.x + to.w / 2));
      fly.y.set(from.top + from.height / 2 - (to.y + to.h / 2));
      fly.s.set(Math.max(from.width / to.w, from.height / to.h));
      const opts = { duration: 0.45, ease };
      animate(fly.x, 0, opts);
      animate(fly.y, 0, opts);
      animate(fly.s, 1, opts);
    }
    document.body.style.setProperty('touch-action', 'none');
    const onResize = () => {
      setWidth(innerWidth);
      track.set(-indexRef.current * innerWidth);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowRight') go(indexRef.current + 1);
      if (e.key === 'ArrowLeft') go(indexRef.current - 1);
    };
    addEventListener('resize', onResize);
    addEventListener('keydown', onKey);
    return () => {
      document.body.style.removeProperty('touch-action');
      removeEventListener('resize', onResize);
      removeEventListener('keydown', onKey);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const indexRef = useRef(index);
  indexRef.current = index;
  const go = (n: number) => {
    const next = Math.max(0, Math.min(photos.length - 1, n));
    setIndex(next);
    animate(track, -next * innerWidth, { type: 'spring', stiffness: 380, damping: 40 });
  };
  const close = () => {
    if (closing) return;
    setClosing(true);
    const p = photos[indexRef.current]!;
    const from = thumbRect(p.id);
    const to = fitRect(p);
    const opts = { duration: reducedMotion() ? 0 : 0.38, ease };
    animate(fade, 0, opts);
    if (from) {
      animate(fly.x, from.left + from.width / 2 - (to.x + to.w / 2) - 0, opts);
      animate(fly.y, from.top + from.height / 2 - (to.y + to.h / 2) - dy.get(), opts);
      animate(
        fly.s,
        Math.max(from.width / to.w, from.height / to.h) / dismissScale.get(),
        opts,
      ).then(onClose);
    } else animate(fly.s, 0.85, opts).then(onClose);
  };

  // Gesture: decide axis on first movement.
  useEffect(() => {
    const el = shell.current!;
    let start: { x: number; y: number; t: number } | null = null;
    let axis: 'x' | 'y' | null = null;
    let base = 0;
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      start = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      axis = null;
      base = track.get();
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x,
        dyv = e.clientY - start.y;
      if (!axis) {
        if (Math.hypot(dx, dyv) < 6) return;
        axis = Math.abs(dx) > Math.abs(dyv) ? 'x' : 'y';
      }
      if (axis === 'x') {
        const edge =
          (indexRef.current === 0 && dx > 0) || (indexRef.current === photos.length - 1 && dx < 0);
        track.set(base + (edge ? dx * 0.35 : dx));
      } else dy.set(dyv);
    };
    const up = (e: PointerEvent) => {
      if (!start) return;
      const dx = e.clientX - start.x,
        dyv = e.clientY - start.y;
      const v = (axis === 'x' ? dx : dyv) / Math.max(1, e.timeStamp - start.t);
      const wasTap = !axis;
      start = null;
      if (wasTap) {
        setChrome((c) => !c);
        return;
      }
      if (axis === 'x') {
        const threshold = innerWidth * 0.22;
        go(
          indexRef.current + (dx < -threshold || v < -0.5 ? 1 : dx > threshold || v > 0.5 ? -1 : 0),
        );
      } else if (Math.abs(dyv) > 120 || Math.abs(v) > 0.7) close();
      else animate(dy, 0, { type: 'spring', stiffness: 500, damping: 40 });
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    return () => {
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const bg = useTransform([fade, backdrop] as const, ([a, b]: number[]) => a! * b!);
  const slideY = useTransform([dy, fly.y] as const, ([a, b]: number[]) => a! + b!);
  const slideScale = useTransform([fly.s, dismissScale] as const, ([a, b]: number[]) => a! * b!);
  return createPortal(
    <div
      className="lightbox"
      ref={shell}
      role="dialog"
      aria-modal="true"
      aria-label={t('照片', 'Photos')}
    >
      <motion.div className="lightbox-bg" style={{ opacity: bg }} />
      <motion.div className="lightbox-track" style={{ x: track }}>
        {photos.map((p, i) => (
          <div key={p.id} className="lightbox-slide" style={{ left: i * width, width }}>
            <motion.img
              src={photoUrl(p.id, Math.abs(i - index) <= 1 ? 'large' : 'thumbnail')}
              alt=""
              draggable={false}
              style={i === index ? { x: fly.x, y: slideY, scale: slideScale } : undefined}
            />
          </div>
        ))}
      </motion.div>
      <motion.div
        className="lightbox-chrome"
        animate={{ opacity: chrome && !closing ? 1 : 0 }}
        style={{ pointerEvents: chrome ? 'auto' : 'none' }}
      >
        <button className="lb-btn lb-close" onClick={close} aria-label={t('关闭', 'Close')}>
          <X />
        </button>
        {photos.length > 1 && (
          <>
            <div className="lb-dots">
              {photos.map((p, i) => (
                <motion.i
                  key={p.id}
                  animate={{ width: i === index ? 18 : 6, opacity: i === index ? 1 : 0.5 }}
                />
              ))}
            </div>
            <button
              className="lb-btn lb-prev"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              aria-label={t('上一张', 'Previous')}
            >
              <ChevronLeft />
            </button>
            <button
              className="lb-btn lb-next"
              onClick={() => go(index + 1)}
              disabled={index === photos.length - 1}
              aria-label={t('下一张', 'Next')}
            >
              <ChevronRight />
            </button>
          </>
        )}
      </motion.div>
    </div>,
    document.body,
  );
}
