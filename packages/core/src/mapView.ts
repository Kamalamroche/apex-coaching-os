/* Web Mercator maths for drawing a route on standard 256-pixel map tiles: where a point lands in
   pixels at a zoom, the zoom that fits a route into a box, and which tiles cover that box. Pure, so the
   map component only places images and draws the line. */

export const TILE = 256;
const MAX_LAT = 85.05112878;

/** Pixel position of a point in the whole world at zoom z (top left of the world is 0,0). */
export function worldPx(lat: number, lng: number, z: number): [number, number] {
  const s = TILE * 2 ** z;
  const phi = (Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180;
  return [((lng + 180) / 360) * s, (0.5 - Math.log((1 + Math.sin(phi)) / (1 - Math.sin(phi))) / (4 * Math.PI)) * s];
}

export interface MapView {
  zoom: number;
  /** World pixel at the box's top left corner. */
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * The closest zoom (whole steps, at most `maxZoom`) at which every point fits inside a width × height box
 * with `pad` pixels to spare on each side, centred on the route.
 */
export function fitView(points: [number, number][], width: number, height: number, pad = 28, maxZoom = 17): MapView {
  let zoom = maxZoom;
  for (; zoom > 1; zoom--) {
    const px = points.map(([la, ln]) => worldPx(la, ln, zoom));
    const w = Math.max(...px.map((p) => p[0])) - Math.min(...px.map((p) => p[0]));
    const h = Math.max(...px.map((p) => p[1])) - Math.min(...px.map((p) => p[1]));
    if (w <= width - pad * 2 && h <= height - pad * 2) break;
  }
  const px = points.map(([la, ln]) => worldPx(la, ln, zoom));
  const cx = (Math.max(...px.map((p) => p[0])) + Math.min(...px.map((p) => p[0]))) / 2;
  const cy = (Math.max(...px.map((p) => p[1])) + Math.min(...px.map((p) => p[1]))) / 2;
  return { zoom, left: cx - width / 2, top: cy - height / 2, width, height };
}

/** A point's position inside the view's box. */
export const viewPx = (v: MapView, lat: number, lng: number): [number, number] => {
  const [x, y] = worldPx(lat, lng, v.zoom);
  return [x - v.left, y - v.top];
};

export interface TileRef {
  z: number;
  x: number;
  y: number;
  /** Where the tile's top left sits inside the box. */
  left: number;
  top: number;
}

/** Every tile that touches the box. x wraps round the world; rows off the top or bottom are left out. */
export function tilesFor(v: MapView): TileRef[] {
  const n = 2 ** v.zoom;
  const out: TileRef[] = [];
  for (let ty = Math.floor(v.top / TILE); ty * TILE < v.top + v.height; ty++) {
    if (ty < 0 || ty >= n) continue;
    for (let tx = Math.floor(v.left / TILE); tx * TILE < v.left + v.width; tx++) {
      out.push({ z: v.zoom, x: ((tx % n) + n) % n, y: ty, left: tx * TILE - v.left, top: ty * TILE - v.top });
    }
  }
  return out;
}
