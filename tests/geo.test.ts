import { expect, it } from 'vitest';
import { projectWorld } from '../src/app/travel/geo';

it('projects coordinates onto the static world map like the build-time d3 projection', () => {
  const [x, y] = projectWorld(116.4, 39.9);
  expect(x).toBeCloseTo(636.786, 2);
  expect(y).toBeCloseTo(122.303, 2);
  const [cx, cy] = projectWorld(0, 0);
  expect(cx).toBe(400);
  expect(cy).toBeCloseTo(224.416, 2);
});
