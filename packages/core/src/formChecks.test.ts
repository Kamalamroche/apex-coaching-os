import { describe, expect, it } from "vitest";
import { awaitingReview, createDemoFormCheckStore, fromFormCheckRow, toFormCheckRow, videoPath, videoProblem } from "./formChecks";

const MB = 1024 * 1024;

describe("form checks", () => {
  it("accepts phone videos and turns away the rest", () => {
    expect(videoProblem({ size: 20 * MB, type: "video/mp4" })).toBeNull();
    expect(videoProblem({ size: 20 * MB, type: "video/quicktime" })).toBeNull();
    expect(videoProblem({ size: 1 * MB, type: "image/jpeg" })).toMatch(/isn't a video/);
    expect(videoProblem({ size: 1 * MB, type: "video/x-msvideo" })).toMatch(/format/);
    expect(videoProblem({ size: 51 * MB, type: "video/mp4" })).toMatch(/50 MB/);
    expect(videoProblem({ size: 0, type: "video/mp4" })).toMatch(/empty/);
  });

  it("keeps videos in the client's own folder", () => {
    expect(videoPath("c1", "x", "video/quicktime")).toBe("c1/x.mov");
    expect(videoPath("c1", "x", "video/mp4")).toBe("c1/x.mp4");
  });

  it("round-trips a row", () => {
    const row = { ...toFormCheckRow({ exerciseId: 7, exercise: "Squat", note: "  depth? " }, "c1", "id1", "c1/id1.mp4"), created_at: "2026-11-03T10:00:00Z", coach_reply: null, reviewed_at: null };
    expect(row.note).toBe("depth?");
    const c = fromFormCheckRow(row, "https://x");
    expect(c).toMatchObject({ id: "id1", exerciseId: 7, exercise: "Squat", note: "depth?", url: "https://x", reviewedAt: null });
  });

  it("demo: send, reply, take back", async () => {
    const s = createDemoFormCheckStore(() => "blob:x");
    expect(awaitingReview(s.get().checks)).toHaveLength(1);
    await s.submit({ exerciseId: 1, exercise: "Trap Bar Deadlift", note: "Back ok?", file: new Blob(["v"], { type: "video/mp4" }) });
    expect(s.get().checks[0]?.url).toBe("blob:x");
    await expect(s.submit({ exerciseId: 1, exercise: "x", note: "", file: new Blob(["v"], { type: "text/plain" }) })).rejects.toThrow(/isn't a video/);
    const id = s.get().checks[0]?.id ?? "";
    await s.reply(id, "Looks solid, brace a bit harder");
    expect(awaitingReview(s.get().checks)).toHaveLength(1);
    await s.remove(id);
    expect(s.get().checks).toHaveLength(1);
  });
});
