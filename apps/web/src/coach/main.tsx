import { Gate } from "../app/Gate";
import { mount } from "../mount";
import { CoachApp } from "./CoachApp";
import { CoachLive } from "./CoachLive";

mount(<Gate side="coach" demo={() => <CoachApp />} live={(l) => <CoachLive {...l} />} />);
