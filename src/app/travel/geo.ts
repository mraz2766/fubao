/**
 * Natural Earth projection with the constants used to render `world-paths.json`
 * (d3 geoNaturalEarth1 fitted to [[8,8],[792,382]]), so points line up with the static map.
 */
const SCALE = 145.05025157215823;
const TX = 400;
const TY = 224.41623676520302;

export function projectWorld(longitude: number, latitude: number): [number, number] {
  const lambda = (longitude * Math.PI) / 180,
    phi = (latitude * Math.PI) / 180;
  const phi2 = phi * phi,
    phi4 = phi2 * phi2;
  const x =
    lambda *
    (0.8707 - 0.131979 * phi2 + phi4 * (-0.013791 + phi4 * (0.003971 * phi2 - 0.001529 * phi4)));
  const y =
    phi * (1.007226 + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 0.005916 * phi4)));
  return [TX + SCALE * x, TY - SCALE * y];
}
