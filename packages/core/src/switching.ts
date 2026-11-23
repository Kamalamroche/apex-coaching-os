/* Switching to APEX from another coaching app.

   Most coaching apps let a coach export a client list as CSV, but not workout history or
   programmes (those come out as PDF at best). So switching is: the client list as a CSV, then
   each client's programme as a PDF or pasted text, both read by the import in transfer.ts.
   The steps below say where to look, written in our own words; menus change, so each guide
   ends with the fallback of asking that app's support for a CSV. */

export type SwitchAppId = "trainerize" | "truecoach" | "everfit" | "mypthub" | "ptdistinction" | "spreadsheet" | "other";

export interface SwitchGuide {
  id: SwitchAppId;
  name: string;
  /** Where the client list comes out, step by step. */
  clients: string[];
  /** How to bring programmes across. */
  programmes: string;
}

const ASK_SUPPORT = "Can't find it? Ask their support for “a CSV of my clients”. They have to give you your data.";
const PDF_PROGRAMMES = "Open a client's programme, print or save it as PDF, and drop the PDF here. APEX reads the exercises, sets and reps.";

export const SWITCH_GUIDES: SwitchGuide[] = [
  {
    id: "trainerize",
    name: "Trainerize",
    clients: ["Open Clients and choose All clients", "Press Export and pick CSV", "Drop the CSV file here"],
    programmes: PDF_PROGRAMMES,
  },
  {
    id: "truecoach",
    name: "TrueCoach",
    clients: ["Open your client list (active clients)", "Use Export clients: the CSV arrives by email", "Download it from the email and drop it here"],
    programmes: PDF_PROGRAMMES,
  },
  {
    id: "everfit",
    name: "Everfit",
    clients: ["Open Clients", "Open the ⋯ menu and choose Export", "Drop the CSV file here"],
    programmes: PDF_PROGRAMMES,
  },
  {
    id: "mypthub",
    name: "My PT Hub",
    clients: ["Look for Export in your Clients area", "Save the client list as CSV", "Drop the CSV file here"],
    programmes: PDF_PROGRAMMES,
  },
  {
    id: "ptdistinction",
    name: "PT Distinction",
    clients: ["Look for Export in your Clients area", "Save the client list as CSV", "Drop the CSV file here"],
    programmes: PDF_PROGRAMMES,
  },
  {
    id: "spreadsheet",
    name: "A spreadsheet",
    clients: ["Put one client per row with a Name or First name and Last name column", "Download it as CSV, or copy the cells and paste them", "Drop it here, or use Paste"],
    programmes: "One row per exercise with Client, Week, Day, Exercise, Sets and Reps. The template below has every column.",
  },
  {
    id: "other",
    name: "Another app",
    clients: ["Look for Export or Download in that app's client list", "Choose CSV (or Excel, then save it as CSV)", "Drop the file here"],
    programmes: "Save each one as PDF, or copy the text and paste it. APEX reads lines like “Back squat 4 x 8 @ 60kg”.",
  },
];

export const ASK_SUPPORT_TIP = ASK_SUPPORT;

/** The guide for an app id; the general one when unknown. */
export const switchGuide = (id: SwitchAppId): SwitchGuide => SWITCH_GUIDES.find((g) => g.id === id) ?? SWITCH_GUIDES[SWITCH_GUIDES.length - 1]!;

const NAME_HINTS: [RegExp, SwitchAppId][] = [
  [/trainerize/i, "trainerize"],
  [/true\s*coach/i, "truecoach"],
  [/everfit/i, "everfit"],
  [/my\s*-?\s*pt\s*-?\s*hub/i, "mypthub"],
  [/pt\s*-?\s*distinction/i, "ptdistinction"],
];

/** Which app a file came from, when its name says so ("trainerize_clients.csv"). */
export function sourceAppFromFileName(fileName: string): SwitchAppId | null {
  return NAME_HINTS.find(([re]) => re.test(fileName))?.[1] ?? null;
}

/** "Trainerize export" for a file named after an app; null otherwise. */
export function switchSourceLabel(fileName: string): string | null {
  const id = sourceAppFromFileName(fileName);
  return id ? `${switchGuide(id).name} export` : null;
}
