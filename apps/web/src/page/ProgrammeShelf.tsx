import type { PublicProgramme } from "@apex/core";
import { ProgrammePoster } from "@apex/ui";
import { useEffect, useMemo, useState } from "react";
import { demoPublicProgrammes, livePublicProgrammes } from "../data/programmes";
import { isDemo, supabase } from "../data/supabase";

/** The coach's live programmes on their public page. Tapping one asks to train, with the programme named. */
export function ProgrammeShelf({ slug, first, onPick }: { slug: string; first: string; onPick: (p: PublicProgramme) => void }) {
  const demo = isDemo() || !supabase;
  const [list, setList] = useState<PublicProgramme[]>(() => (demo ? demoPublicProgrammes() : []));
  const db = useMemo(() => (demo ? null : supabase), [demo]);
  useEffect(() => {
    if (db) void livePublicProgrammes(db, slug).then(setList);
  }, [db, slug]);
  if (!list.length) return null;
  return (
    <section className="pg-sect" aria-label="Programmes">
      <span className="gr-eyebrow" style={{ marginBottom: 0 }}>Programmes by {first}</span>
      <div className="pg-grid">
        {list.map((p, i) => <ProgrammePoster key={p.id} p={p} i={i} onOpen={() => onPick(p)} />)}
      </div>
    </section>
  );
}
