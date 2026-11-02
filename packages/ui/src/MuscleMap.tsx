import type { BodyRegion, RegionRole } from "@apex/core";
import { useId } from "react";

/* Original HELIX body map: a segmented figure, front and back, with the worked muscles lit.
   Each figure is drawn as its left half and mirrored, so both sides always match.
   Primary muscles take a soft orange gradient, supporting ones the structure blue;
   hairline gaps in the card colour separate the segments. */

type Shape = { region?: BodyRegion; d: string };

/* Unlit body parts (head, hands, knees, feet) give the figure its outline. */
const FRONT: Shape[] = [
  { d: "M60 6 C52 6 48 12 48 20 C48 28 53 33 60 33 Z" },
  { region: "neck", d: "M54.5 32 C55 36 55 38 54 41 L60 42 L60 33 Z" },
  { region: "traps", d: "M53.5 38 C50 41 45 43 40.5 44.5 L52.5 45 Z" },
  { region: "delts", d: "M39 45.5 C32 46.5 28.5 52 28.5 60 C29.5 63 32 63.5 34 61.5 C35.5 55 39 50.5 44 48.5 Z" },
  { region: "chest", d: "M59.2 47 L46.5 47 C42 49.5 39.8 54 40.5 60 C43 66.5 50 68.5 59.2 66 Z" },
  { region: "biceps", d: "M29.5 65 C26.5 71 26 79 27.5 86 C30 87.5 32.5 87 34 85 C35.5 78 36 71 35.8 64 Z" },
  { region: "forearms", d: "M27 89.5 C23.5 97 21.5 106 21 116 C22.5 117.5 25 117.5 26.5 116 C29 107 31.5 98 33.5 89.5 Z" },
  { d: "M21 119.5 C19 122 18.5 127 20.5 130 C23 131 25.5 129 26.5 125 L26.5 119.5 Z" },
  { region: "serratus", d: "M41 62.5 C40.3 67 41 72 43 76 L45.5 73 C44.5 69.5 44.3 66 44.8 63.5 Z" },
  { region: "obliques", d: "M45.5 76 C44.5 86 45.5 97 48.5 107 L51.3 104.5 L51.3 69 C49 70 47 72.5 45.5 76 Z" },
  { region: "abs", d: "M52.5 68.5 L59.2 68 L59.2 78.5 L52.5 78.5 Z M52.5 80.5 L59.2 80.5 L59.2 90.5 L52.5 90.5 Z M52.5 92.5 L59.2 92.5 L59.2 102.5 L52.5 102.5 Z M52.5 104.5 L59.2 104.5 L59.2 117 C55.5 115.5 53.5 111.5 52.5 104.5 Z" },
  { region: "hipFlexors", d: "M48.5 109.5 C50.5 115 54 119.5 58.8 122.5 L58.8 120 C55 117.5 52.5 113.5 51.3 108 Z" },
  { region: "quads", d: "M47.5 112 C41.5 126 39.5 143 41 160 C44.5 165.5 49.5 166 53 163 C55.5 150 56.5 136 56 124 C52.5 120.5 49.5 116.5 47.5 112 Z" },
  { region: "adductors", d: "M57.5 125.5 C58.3 135 57.5 145 55.5 154 C57 155 58.5 153.5 59.2 150 L59.2 126.5 Z" },
  { d: "M42 166.5 C41.3 170 42 173.5 44.5 175 L51 175 C53 172.5 53.3 169.5 52.5 166.5 C49 168.5 45.5 168.5 42 166.5 Z" },
  { region: "tibialis", d: "M43 177.5 C41 192 42 207 44.5 221 L47.5 221 C48.5 207 49.5 192 49.5 177.5 Z" },
  { region: "calves", d: "M50.8 178 C53.5 190 53.5 203 51 214 L49.5 213.5 C50.5 201 51 189 50.8 178 Z" },
  { d: "M44 224 C42.5 228 41.5 232 42.5 235 C46 236.5 50.5 236 52 233.5 C51 230 49.5 226.5 48.5 224 Z" },
];

const BACK: Shape[] = [
  { d: "M60 6 C52 6 48 12 48 20 C48 28 53 33 60 33 Z" },
  { region: "traps", d: "M59.2 32 L55 33 C54 37 51 41 41 45 L52 48.5 C55.5 55 57.5 63 59.2 71 Z" },
  { region: "rearDelts", d: "M39.5 46 C32 47 28.5 52.5 28.5 60 C29.5 63 32 63.5 34 61.5 C35.5 55.5 38.5 51.5 43 49 Z" },
  { region: "upperBack", d: "M45 50.5 C42.5 55 42 61 44 66 L56.5 69.5 C55 62.5 53 56 50.5 51.5 Z" },
  { region: "lats", d: "M42.5 68.5 C41 79 43.5 90 50 99.5 L57.5 95.5 L57.5 73 C52.5 71.5 47.5 70 42.5 68.5 Z" },
  { region: "lowerBack", d: "M52 101 L59.2 97.5 L59.2 112 L51 112 C51 108 51.3 104.5 52 101 Z" },
  { region: "triceps", d: "M29.5 65 C26.5 71 26 79 27.5 86 C30 87.5 32.5 87 34 85 C35.5 78 36 71 35.8 64 Z" },
  { region: "forearms", d: "M27 89.5 C23.5 97 21.5 106 21 116 C22.5 117.5 25 117.5 26.5 116 C29 107 31.5 98 33.5 89.5 Z" },
  { d: "M21 119.5 C19 122 18.5 127 20.5 130 C23 131 25.5 129 26.5 125 L26.5 119.5 Z" },
  { region: "gluteMed", d: "M47.5 103 C45 107 44 111.5 44.5 116 L50 113.5 C49.5 110 49.8 106 50.5 102 Z" },
  { region: "glutes", d: "M45.5 118.5 C44 127 45.5 134.5 51.5 138 C56 139 58.5 136 59.2 131 L59.2 114 C55 113.5 49.5 115 45.5 118.5 Z" },
  { region: "hamstrings", d: "M44 141 C41 151 41 161 43 167 C46.5 169 50 169 53.5 167 C56 158 57 149 56.5 141.5 C52.5 142.5 48 142.5 44 141 Z" },
  { region: "adductors", d: "M57.8 142 C58.5 149 58.5 156 57.5 162 L59.2 161 L59.2 141.5 Z" },
  { d: "M43 170 C42.5 172.5 43 175 44.5 176 L52 176 C53.3 174 53.5 172 53 170 C49.5 171.5 46.5 171.5 43 170 Z" },
  { region: "calves", d: "M43 178.5 C39.5 189 40.5 201 44 210 C47 212 50 211 51.5 208 C53.5 198 53 188 51.5 178.5 Z" },
  { d: "M44.5 213 C44 217 44.3 220 45 223 L49.5 223 C50 220 50.3 216.5 50.5 213 Z" },
  { d: "M44 225 C42.5 228.5 42 232 43 235 C46.5 236.5 50.5 236 52 233.5 C51 230 50 227 49.5 225 Z" },
];

const MUSCLE = "color-mix(in srgb,var(--text3) 26%,transparent)";
const FRAME = "color-mix(in srgb,var(--text3) 14%,transparent)";
const SUPPORT = "color-mix(in srgb,var(--blue) 50%,transparent)";

function Figure({ shapes, lit, label }: { shapes: Shape[]; lit: Partial<Record<BodyRegion, RegionRole>>; label: string }) {
  const grad = `mm-${useId().replace(/:/g, "")}`;
  const fill = (s: Shape) => {
    if (!s.region) return FRAME;
    const role = lit[s.region];
    return role === "primary" ? `url(#${grad})` : role === "supporting" ? SUPPORT : MUSCLE;
  };
  const half = shapes.map((s, i) => (
    <path key={i} d={s.d} fill={fill(s)} stroke="var(--card)" strokeWidth={0.9} strokeLinejoin="round" />
  ));
  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg viewBox="14 2 92 238" width="100%" style={{ maxWidth: 104 }} role="img" aria-label={`${label} body map`}>
        <defs>
          <linearGradient id={grad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: "color-mix(in srgb,var(--act) 70%,#FFD2B0)" }} />
            <stop offset="1" style={{ stopColor: "var(--act)" }} />
          </linearGradient>
        </defs>
        <g>{half}</g>
        <g transform="translate(120 0) scale(-1 1)">{half}</g>
      </svg>
      <figcaption style={{ font: "600 9.5px/1 var(--ui)", letterSpacing: ".14em", textTransform: "uppercase", color: "var(--text3)" }}>{label}</figcaption>
    </figure>
  );
}

export function MuscleMap({ lit }: { lit: Partial<Record<BodyRegion, RegionRole>> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
      <Figure shapes={FRONT} lit={lit} label="Front" />
      <Figure shapes={BACK} lit={lit} label="Back" />
    </div>
  );
}
