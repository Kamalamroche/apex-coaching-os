import { describe, expect, it } from "vitest";
import { appLink, buildAlertEmail, namesList, snippet } from "./content";

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
});
