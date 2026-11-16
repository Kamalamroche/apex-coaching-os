import { needsOnboarding, onboardingAt, onboardingSteps, upcomingBookings, type OnboardingStep, type OnboardingStepId } from "@apex/core";
import { Icons, OnboardingDone, OnboardingHeader } from "@apex/ui";
import { useEffect, useState } from "react";
import { useAppInfo } from "../app/AppContext";
import { useBookings } from "../app/BookingParts";
import { IosSteps, usePush } from "../app/PushParts";
import { useBookingApi } from "../data/bookings";
import { useLifestyle } from "../data/LifestyleContext";
import { usePrivacyApi } from "../data/privacy";
import { browserPushSupport } from "../data/push";
import type { Agreement } from "@apex/core";
import { SignRequired } from "./screens/Agreements";
import { Book } from "./screens/Book";
import { Intake } from "./screens/Intake";

/* A brand-new client's first visit: one guided path through signing, the questionnaire, a first booking and reminders,
   instead of four separate places. Shown once, to clients who haven't answered the questionnaire yet. */

const DONE_KEY = "apex.onboarding.done";
const read = () => { try { return localStorage.getItem(DONE_KEY) === "1"; } catch { return false; } };
const write = () => {
  if (new URLSearchParams(location.search).has("welcome")) return;
  try { localStorage.setItem(DONE_KEY, "1"); } catch { /* this visit only */ }
};

/** null while the facts load. Then the steps, fixed for this visit so the count never jumps. */
export function useOnboarding(agreements: { data: unknown; required: Agreement[] }) {
  const life = useLifestyle();
  const { coachName, mode } = useAppInfo();
  const bookingApi = useBookingApi();
  const bookings = useBookings(bookingApi);
  const privacy = usePrivacyApi();
  const push = usePush(privacy);
  const [steps, setSteps] = useState<OnboardingStep[] | null>(null);
  const [off] = useState(read);
  const bookingsReady = !bookingApi || bookings.status !== "loading";
  const pushReady = !privacy || push.on !== null || browserPushSupport() === "unsupported";
  const ready = life.status !== "loading" && agreements.data !== null && bookingsReady && pushReady;
  useEffect(() => {
    if (steps || !ready) return;
    // The demo shows it only on request (?demo&welcome), so a coach can see what new clients get.
    const preview = mode === "demo" && new URLSearchParams(location.search).has("welcome");
    if ((off && !preview) || (mode === "demo" && !preview) || (!preview && !needsOnboarding({ hasIntake: !!life.intake }))) return setSteps([]);
    const support = browserPushSupport();
    const mine = bookingApi ? upcomingBookings(bookings.bookings.filter((b) => b.clientId === bookingApi.me), new Date()) : [];
    setSteps(onboardingSteps({
      toSign: agreements.required.length,
      hasIntake: preview ? false : !!life.intake,
      canBook: (!!bookingApi?.live || preview) && !!bookings.settings && bookings.settings.windows.length > 0,
      hasBooking: preview ? false : mine.length > 0,
      remindersOn: preview ? false : support === "unsupported" || support === "blocked" || !privacy ? null : !!push.on,
      coach: coachName,
    }));
  }, [steps, ready, off, mode, life.intake, agreements.required.length, bookingApi, bookings.bookings, bookings.settings, push.on, privacy, coachName]);
  return steps;
}

export function Onboarding({ steps, agreements, onFinish, say }: { steps: OnboardingStep[]; agreements: { required: Agreement[]; reload: () => Promise<void> }; onFinish: () => void; say: (m: string) => void }) {
  const { coachName, mode } = useAppInfo();
  const [finished, setFinished] = useState<OnboardingStepId[]>([]);
  const privacy = usePrivacyApi();
  const push = usePush(privacy);
  const [iosSteps, setIosSteps] = useState(false);
  const done = (id: OnboardingStepId) => { setFinished((f) => [...f, id]); window.scrollTo(0, 0); };
  // Signing is required: the step ends when nothing is left to sign.
  useEffect(() => { if (agreements.required.length === 0 && steps.some((s) => s.id === "sign") && !finished.includes("sign")) done("sign"); }, [agreements.required.length, steps, finished]);
  const at = onboardingAt(steps, finished);
  const finish = () => { write(); onFinish(); window.scrollTo(0, 0); };

  if (!at) {
    return (
      <OnboardingDone coach={coachName}>
        <button className="btn act block" onClick={finish}>See today's plan <Icons.arrow width={16} height={16} /></button>
      </OnboardingDone>
    );
  }
  const { step, index, total } = at;
  const skip = step.id === "sign" ? undefined : () => done(step.id);
  return (
    <>
      <OnboardingHeader step={step} index={index} total={total} onSkip={skip} />
      {step.id === "sign" && <SignRequired list={agreements.required} onSigned={agreements.reload} say={say} />}
      {step.id === "about" && <Intake bare onExit={() => done("about")} onDone={() => { say(`Sent · ${coachName} can see your answers`); done("about"); }} />}
      {step.id === "book" && (
        <>
          <Book say={say} />
          <button className="btn block" onClick={() => done("book")}>Continue</button>
        </>
      )}
      {step.id === "reminders" && (
        <section className="card stack">
          {iosSteps && <IosSteps />}
          {push.error && <div className="small" role="alert">{push.error}</div>}
          {push.on ? (
            <button className="btn act block" onClick={() => done("reminders")}>Reminders are on · continue</button>
          ) : (
            <button className="btn act block" disabled={push.busy} onClick={() => void (async () => {
              if (!privacy || mode === "demo") { say("Reminders switch on here in the real app"); return done("reminders"); }
              if (push.support === "ios-install") return setIosSteps(true);
              if (await push.enable()) { say("Reminders are on"); done("reminders"); }
            })()}>{push.busy ? "Turning on…" : "Turn on reminders"}</button>
          )}
        </section>
      )}
    </>
  );
}
