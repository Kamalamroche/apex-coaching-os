import { Avatar } from "@apex/ui";
import { useAppInfo } from "../../app/AppContext";
import { Thread } from "../../app/Thread";

export function Chat() {
  const { coachName } = useAppInfo();
  return (
    <>
      <div className="row"><Avatar initials={coachName.slice(0, 1).toUpperCase()} tone="var(--act)" /><div><h1 className="h1" style={{ fontSize: 20 }}>Coach {coachName}</h1><div className="tiny">Usually replies within a few hours</div></div></div>
      <Thread me="client" to={coachName} />
    </>
  );
}
