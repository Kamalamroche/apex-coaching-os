import { describe, expect, it } from "vitest";
import { parseCsv } from "./csv";
import { SWITCH_GUIDES, sourceAppFromFileName, switchSourceLabel, switchGuide } from "./switching";
import { detectKind, hasClientColumn, isPastStatus, readTables, withoutPastClients } from "./transfer";

const table = (name: string, text: string) => ({ name, rows: parseCsv(text) });

describe("switching guides", () => {
  it("has steps and a programme tip for every app", () => {
    for (const g of SWITCH_GUIDES) {
      expect(g.clients.length).toBeGreaterThan(1);
      expect(g.programmes.length).toBeGreaterThan(20);
    }
    expect(switchGuide("truecoach").name).toBe("TrueCoach");
  });

  it("names the app a file came from", () => {
    expect(sourceAppFromFileName("Trainerize_clients_2026.csv")).toBe("trainerize");
    expect(sourceAppFromFileName("truecoach-export.csv")).toBe("truecoach");
    expect(sourceAppFromFileName("my-pt-hub clients.csv")).toBe("mypthub");
    expect(sourceAppFromFileName("clients.csv")).toBeNull();
    expect(switchSourceLabel("everfit.csv")).toBe("Everfit export");
  });
});

describe("client lists from other apps", () => {
  const csv = [
    "First Name,Last Name,Email,Phone,Status,Tags,Start Date,Weight,Compliance",
    "Priya,Shah,priya@example.com,07700 900123,Active,Online;Fat loss,01/09/2026,62,92%",
    "Sam,Lee,sam@example.com,,Archived,,12/03/2025,80,10%",
    "Ade,Okafor,ade@example.com,,Pending,,,,",
  ].join("\n");
  const headers = parseCsv(csv)[0]!;

  it("reads a split-name export as a client list, not check-ins", () => {
    expect(detectKind(headers)).toBe("clients");
    expect(hasClientColumn(headers)).toBe(true);
  });

  it("joins first and last names and keeps phone and tags in notes", () => {
    const b = readTables([table("trainerize.csv", csv)]);
    expect(b.clients.map((c) => c.name)).toEqual(["Priya Shah", "Sam Lee", "Ade Okafor"]);
    expect(b.clients[0]).toMatchObject({ email: "priya@example.com", notes: "Phone: 07700 900123 · Tags: Online;Fat loss", past: false });
    expect(b.problems).toEqual([]);
  });

  it("marks archived clients as past so the coach can leave them out", () => {
    const b = readTables([table("trainerize.csv", csv)]);
    expect(b.clients.filter((c) => c.past).map((c) => c.name)).toEqual(["Sam Lee"]);
    expect(withoutPastClients(b).clients.map((c) => c.name)).toEqual(["Priya Shah", "Ade Okafor"]);
    expect(isPastStatus("Inactive")).toBe(true);
    expect(isPastStatus("Paused")).toBe(false);
    expect(isPastStatus("invited")).toBe(false);
  });

  it("still reads check-ins that carry a client name", () => {
    expect(detectKind(["Client", "Date", "Weight (kg)", "Energy"])).toBe("checkins");
  });
});
