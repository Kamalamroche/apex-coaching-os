import { describe, expect, it, vi } from "vitest";
import { DEMO_STORAGE_KEY, createDemoStore, initialState } from "./store";

const memoryStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

describe("demo store", () => {
  it("persists updates so a second app instance reads them", () => {
    const storage = memoryStorage();
    const coach = createDemoStore(storage, null);
    coach.saveWorkout({ ...coach.get().workout, name: "Edited" });
    const client = createDemoStore(storage, null);
    expect(client.get().workout.name).toBe("Edited");
  });

  it("notifies subscribers and stops after unsubscribe", () => {
    const store = createDemoStore(memoryStorage(), null);
    const fn = vi.fn();
    const off = store.subscribe(fn);
    store.sendMessage("client", "hi");
    off();
    store.sendMessage("client", "again");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("falls back to sample data when storage is corrupt or missing", () => {
    const storage = memoryStorage();
    storage.setItem(DEMO_STORAGE_KEY, "{not json");
    expect(createDemoStore(storage, null).get()).toEqual(initialState());
    expect(createDemoStore(null, null).get()).toEqual(initialState());
  });

  it("appends messages in order", () => {
    const store = createDemoStore(memoryStorage(), null);
    const before = store.get().messages.length;
    store.sendMessage("client", "Hip felt fine");
    expect(store.get().messages.slice(before)).toEqual([{ from: "client", text: "Hip felt fine", time: "Now" }]);
  });

  it("reset clears saved data", () => {
    const storage = memoryStorage();
    const store = createDemoStore(storage, null);
    store.finishSession({ workoutName: "x", sets: 1, volumeKg: 1, minutes: 1, rpe: 7, prs: 0 }, {});
    store.reset();
    expect(store.get().log).toBeNull();
    expect(storage.getItem(DEMO_STORAGE_KEY)).toBeNull();
  });
});
