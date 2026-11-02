import { describe, expect, it } from "vitest";
import { fitView, tilesFor, TILE, viewPx, worldPx } from "./mapView";

describe("map view", () => {
  it("puts lat 0, lng 0 in the middle of the world", () => {
    expect(worldPx(0, 0, 0)).toEqual([128, 128]);
    const [x, y] = worldPx(51.5, -0.12, 10);
    // Tile 511, 340 at zoom 10 holds central London.
    expect(Math.floor(x / TILE)).toBe(511);
    expect(Math.floor(y / TILE)).toBe(340);
  });

  it("fits a park loop with room to spare and centres it", () => {
    const loop: [number, number][] = [[51.531, -0.16], [51.523, -0.16], [51.523, -0.148], [51.531, -0.148]];
    const v = fitView(loop, 360, 240);
    expect(v.zoom).toBeGreaterThanOrEqual(14);
    expect(v.zoom).toBeLessThanOrEqual(16);
    const pts = loop.map(([a, b]) => viewPx(v, a, b));
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(28);
      expect(x).toBeLessThanOrEqual(360 - 28);
      expect(y).toBeGreaterThanOrEqual(28);
      expect(y).toBeLessThanOrEqual(240 - 28);
    }
    const cx = (Math.min(...pts.map((p) => p[0])) + Math.max(...pts.map((p) => p[0]))) / 2;
    expect(cx).toBeCloseTo(180, 5);
    // One zoom closer would no longer fit.
    const tight = fitView(loop, 360, 240, 28, v.zoom + 1);
    expect(tight.zoom).toBe(v.zoom);
  });

  it("lists the tiles that cover the box, no more", () => {
    const v = { zoom: 2, left: 300, top: 200, width: 300, height: 100 };
    const t = tilesFor(v);
    expect(t.map((x) => `${x.x},${x.y}`)).toEqual(["1,0", "2,0", "1,1", "2,1"]);
    expect(t[0]).toMatchObject({ left: -44, top: -200 });
  });
});
