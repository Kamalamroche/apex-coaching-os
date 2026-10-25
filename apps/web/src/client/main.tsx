import { Gate } from "../app/Gate";
import { mount } from "../mount";
import { ClientApp } from "./ClientApp";
import { ClientLive } from "./ClientLive";

mount(<Gate side="client" demo={() => <ClientApp />} live={(l) => <ClientLive {...l} />} />);
