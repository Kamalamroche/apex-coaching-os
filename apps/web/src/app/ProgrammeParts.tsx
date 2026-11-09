import { daysPerWeek, type Enrolment, type ProgrammeListing } from "@apex/core";
import type { PosterData } from "@apex/ui";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PROGRAMMES_NEED_UPDATE, demoProgrammes, useProgrammeApi, type ProgrammeApi } from "../data/programmes";
import { useAppInfo } from "./AppContext";

/** The programme API for this side: the live one from context, or this browser's sample shop in the demo. */
export function useProgrammesApi(side: "coach" | "client", live?: ProgrammeApi | null): ProgrammeApi | null {
  const ctx = useProgrammeApi();
  const { mode } = useAppInfo();
  const demo = useMemo(() => demoProgrammes(side), [side]);
  return live ?? ctx ?? (mode === "demo" ? demo : null);
}

export interface ProgrammeData {
  status: "loading" | "ready" | "needs-update" | "error";
  error?: string;
  listings: ProgrammeListing[];
  enrolments: Enrolment[];
  reload: () => Promise<void>;
}

export function useProgrammes(api: ProgrammeApi | null): ProgrammeData {
  const [s, setS] = useState<Omit<ProgrammeData, "reload">>({ status: "loading", listings: [], enrolments: [] });
  const reload = useCallback(async () => {
    if (!api) return;
    try {
      const [listings, enrolments] = await Promise.all([api.listings(), api.enrolments()]);
      setS({ status: "ready", listings, enrolments });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setS((p) => ({ ...p, status: msg === PROGRAMMES_NEED_UPDATE ? "needs-update" : "error", error: msg }));
    }
  }, [api]);
  useEffect(() => void reload(), [reload]);
  return { ...s, reload };
}

export function ProgrammeStatus({ data, side }: { data: ProgrammeData; side: "coach" | "client" }) {
  if (data.status === "loading") return <div className="card small">Loading programmes…</div>;
  if (data.status === "needs-update") {
    return <div className="card small">{side === "coach" ? "Programmes need a quick database update. Run the programmes SQL in Supabase, then reload." : "Programmes are almost ready. Your coach is finishing setting them up."}</div>;
  }
  if (data.status === "error") return <div className="card small" style={{ borderColor: "var(--crit)" }}>Couldn't load programmes: {data.error}</div>;
  return null;
}

export const posterOf = (l: ProgrammeListing): PosterData => ({
  title: l.title, tagline: l.tagline, cover: l.cover, level: l.level, weeks: l.weeks, perWeek: daysPerWeek(l.days), pricePence: l.pricePence,
});
