import { describe, expect, it } from "vitest";
import { fillReply, replyProblem, searchReplies, voiceBody, voiceClock, voiceExt, voicePath, REPLY_IDEAS } from "./chatTools";

describe("saved replies", () => {
  it("fills in the client's first name", () => {
    expect(fillReply("Great work, {name}! {NAME} again", "Priya")).toBe("Great work, Priya! Priya again");
    expect(fillReply("Hi {name}", " ")).toBe("Hi there");
  });
  it("checks a reply before saving", () => {
    expect(replyProblem({ title: "", body: "x" })).toBe("Give it a short name");
    expect(replyProblem({ title: "x".repeat(41), body: "x" })).toMatch(/under 40/);
    expect(replyProblem({ title: "Hi", body: "  " })).toBe("Write the message");
    expect(replyProblem({ title: "Hi", body: "Hello" })).toBeNull();
    for (const r of REPLY_IDEAS) expect(replyProblem(r)).toBeNull();
  });
  it("searches by name first, then text", () => {
    const list = [{ id: "1", title: "Sleep", body: "Rest well" }, { id: "2", title: "Great session", body: "Good sleep helps" }, { id: "3", title: "Protein", body: "Eat" }];
    expect(searchReplies(list, "sleep").map((r) => r.id)).toEqual(["1", "2"]);
    expect(searchReplies(list, "").map((r) => r.id)).toEqual(["1", "2", "3"]);
    expect(searchReplies(list, "zzz")).toEqual([]);
  });
});

describe("voice notes", () => {
  it("shows the length as a clock", () => {
    expect(voiceClock(7)).toBe("0:07");
    expect(voiceClock(90.4)).toBe("1:30");
    expect(voiceBody(12)).toBe("Voice note (0:12)");
  });
  it("names the file after the format and keeps it in the client's folder", () => {
    expect(voiceExt("audio/webm;codecs=opus")).toBe("webm");
    expect(voiceExt("audio/mp4")).toBe("m4a");
    expect(voicePath("client-1", "abc", "audio/mp4")).toBe("client-1/abc.m4a");
  });
});
