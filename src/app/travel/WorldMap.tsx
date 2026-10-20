import { useEffect, useMemo, useState } from 'react';
import { animate, motion, useMotionValue, useMotionValueEvent } from 'motion/react';
import { projectWorld } from './geo';
import type { AtlasItem } from './data';
import { reducedMotion } from '../core/router';

interface Geometry {
  countries: { code: string; path: string }[];
}
let cached: Geometry | null = null;
function useGeometry() {
  const [geo, setGeo] = useState(cached);
  useEffect(() => {
    if (cached) return;
    void import('../../data/world-paths.json').then((m) => {
      cached = (m.default ?? m) as unknown as Geometry;
      setGeo(cached);
    });
  }, []);
  return geo;
}

const FULL = [0, 20, 800, 350] as const;

/** Night-ocean world map: visited countries glow, trips pulse; can zoom to fit your footprints. */
export function WorldMap({
  items,
  focus,
  onPoint,
}: {
  items: AtlasItem[];
  focus: boolean;
  onPoint?: (id: string) => void;
}) {
  const geo = useGeometry();
  const visited = useMemo(() => new Set(items.map((i) => i.country_code).filter(Boolean)), [items]);
  const points = useMemo(() => {
    const seen = new Set<string>();
    return items
      .filter((i) => i.latitude !== null && i.longitude !== null)
      .filter((i) => (seen.has(i.location_id) ? false : (seen.add(i.location_id), true)))
      .map((i) => ({ id: i.id, xy: projectWorld(i.longitude!, i.latitude!) }));
  }, [items]);
  const target = useMemo(() => {
    if (!focus || !points.length) return FULL;
    const xs = points.map((p) => p.xy[0]),
      ys = points.map((p) => p.xy[1]);
    let x0 = Math.min(...xs),
      x1 = Math.max(...xs),
      y0 = Math.min(...ys),
      y1 = Math.max(...ys);
    const pad = 26;
    x0 -= pad;
    x1 += pad;
    y0 -= pad;
    y1 += pad;
    let w = Math.max(240, x1 - x0),
      h = w / (800 / 350);
    if (y1 - y0 > h) {
      h = y1 - y0;
      w = h * (800 / 350);
    }
    const cx = (x0 + x1) / 2,
      cy = (y0 + y1) / 2;
    return [cx - w / 2, cy - h / 2, w, h] as const;
  }, [focus, points]);

  const vx = useMotionValue<number>(FULL[0]),
    vy = useMotionValue<number>(FULL[1]),
    vw = useMotionValue<number>(FULL[2]),
    vh = useMotionValue<number>(FULL[3]);
  const [viewBox, setViewBox] = useState(FULL.join(' '));
  const sync = () => setViewBox(`${vx.get()} ${vy.get()} ${vw.get()} ${vh.get()}`);
  useMotionValueEvent(vw, 'change', sync);
  useMotionValueEvent(vx, 'change', sync);
  useEffect(() => {
    const opts = { duration: reducedMotion() ? 0 : 1.1, ease: [0.65, 0, 0.35, 1] as const };
    const c = [
      animate(vx, target[0], opts),
      animate(vy, target[1], opts),
      animate(vw, target[2], opts),
      animate(vh, target[3], opts),
    ];
    return () => c.forEach((x) => x.stop());
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  const zoom = 800 / vw.get();

  return (
    <svg
      className="world-map"
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="map"
    >
      <defs>
        <linearGradient id="visited-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3be0bd" />
          <stop offset="1" stopColor="#3a8bff" />
        </linearGradient>
        <filter id="glow" filterUnits="userSpaceOnUse" x="-200" y="-200" width="1200" height="800">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g>
        {geo?.countries.map((c, i) =>
          visited.has(c.code) ? null : (
            <path key={`${c.code}-${i}`} d={c.path} className="land" strokeWidth={0.5 / zoom} />
          ),
        )}
      </g>
      <g filter="url(#glow)">
        {geo?.countries
          .filter((c) => visited.has(c.code))
          .map((c, i) => (
            <motion.path
              key={`${c.code}-${i}`}
              d={c.path}
              fill="url(#visited-g)"
              className="land visited"
              strokeWidth={0.5 / zoom}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.08, duration: 0.8 }}
            />
          ))}
      </g>
      <g>
        {points.map((p, i) => (
          <g
            key={p.id}
            transform={`translate(${p.xy[0]} ${p.xy[1]})`}
            onClick={() => onPoint?.(p.id)}
            style={{ cursor: onPoint ? 'pointer' : undefined }}
          >
            <circle
              r={7 / zoom}
              className="pin-pulse"
              style={{ animationDelay: `${(i % 6) * 0.35}s` }}
            />
            <motion.circle
              r={2.6 / zoom}
              className="pin"
              strokeWidth={1 / zoom}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                type: 'spring',
                stiffness: 400,
                damping: 15,
                delay: 0.6 + Math.min(i, 20) * 0.04,
              }}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
