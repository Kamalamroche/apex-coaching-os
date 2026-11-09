import { describe, expect, it } from "vitest";
import { appLink, buildAlertEmail, buildLeadAlert, buildLeadWelcome, namesList, snippet } from "./content";

describe("email alert content", () => {
  it("lists names", () => {
    expect(namesList([])).toBe("Someone");
    expect(namesList(["Priya"])).toBe("Priya");
    expect(namesList(["Priya", "James"])).toBe("Priya and James");
    expect(namesList(["Priya", "James", "Sarah"])).toBe("Priya, James and 1 other");
    expect(namesList(["Priya", "James", "Sarah", "Omar"])).toBe("Priya, James and 2 others");
  });

  it("shortens long messages at a word", () => {
    expect(snippet("  Great   work\n today ")).toBe("Great work today");
    const long = "Squats felt strong today and I think I could add a little more weight next week if that is all right with you, also my knee felt fine throughout";
    const s = snippet(long);
    expect(s.endsWith("…")).toBe(true);
    expect(s.length).toBeLessThanOrEqual(141);
    expect(long.startsWith(s.slice(0, -1))).toBe(true);
  });

  it("links coaches and clients to their own app", () => {
    expect(appLink("https://apex.example/", "coach")).toBe("https://apex.example/coach/");
    expect(appLink("https://apex.example", "client")).toBe("https://apex.example/client/");
  });

  it("builds one-message and many-message emails", () => {
    const one = buildAlertEmail({ firstName: "Priya", role: "client", senders: ["Kamal"], unread: 1, latest: "Great work today", appUrl: "https://apex.example" });
    expect(one.subject).toBe("New message from Kamal on APEX");
    expect(one.text).toContain("Hi Priya,");
    expect(one.text).toContain("https://apex.example/client/");
    expect(one.text).toContain("Privacy and account");
    const many = buildAlertEmail({ firstName: "Kamal", role: "coach", senders: ["Priya", "James"], unread: 3, latest: "Done!", appUrl: "https://apex.example" });
    expect(many.subject).toBe("3 new messages from Priya and James on APEX");
    expect(many.html).toContain("https://apex.example/coach/");
  });

  it("escapes message text in the html", () => {
    const m = buildAlertEmail({ firstName: "", role: "client", senders: ["K"], unread: 1, latest: "<script>x</script> & \"y\"", appUrl: "https://a.b" });
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.text).toContain("Hi,");
  });

  const lead = { coachName: "Kamal Amroche", leadName: "Hana Ito", goal: "Get stronger", message: "Bad knee <3", phone: "07700 900123", how: "hybrid", source: "instagram", welcomeText: "", appUrl: "https://apex.example/" };

  it("welcomes a new enquiry in the coach's words", () => {
    const d = buildLeadWelcome(lead);
    expect(d.subject).toBe("Thanks for getting in touch · Kamal Amroche");
    expect(d.text).toContain("Hi Hana,");
    expect(d.text).toContain("Thanks for getting in touch, Hana.");
    expect(d.text).toContain("Reply to this email to reach Kamal.");
    const own = buildLeadWelcome({ ...lead, welcomeText: "Great to meet you {first}!\n\nBook a call: <link>" });
    expect(own.text).toContain("Great to meet you Hana!");
    expect(own.html).toContain("&lt;link&gt;");
    expect(own.html).not.toContain("<link>");
  });

  it("tells the coach about a new enquiry", () => {
    const a = buildLeadAlert(lead);
    expect(a.subject).toBe("New enquiry from Hana Ito · Get stronger");
    expect(a.text).toContain("How: Hybrid");
    expect(a.text).toContain("From: instagram");
    expect(a.text).toContain("https://apex.example/coach/?open=leads");
    expect(a.html).toContain("Bad knee &lt;3");
    expect(buildLeadAlert({ ...lead, goal: "", phone: "", how: "", message: "" }).text).not.toContain("Phone:");
  });
});
