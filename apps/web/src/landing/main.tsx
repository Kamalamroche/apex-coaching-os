import "@apex/ui/landing.css";
import { useState } from "react";
import { Intro, introSeen } from "../auth/Intro";
import { mount } from "../mount";
import { Landing } from "./Landing";

/** The brand reel plays first when the link is opened (once per tab), then the landing page. */
function LandingWithIntro() {
  const [introDone, setIntroDone] = useState(introSeen);
  return introDone ? <Landing /> : <Intro onDone={() => setIntroDone(true)} />;
}

mount(<LandingWithIntro />);
