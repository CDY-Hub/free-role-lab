import { describe, it, expect, beforeEach } from "vitest";
import {
  loadThreads,
  saveThreads,
  ensureThread,
  updateThread,
  deleteThread,
} from "./threads";

describe("threads", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("loadThreads returnerar tom array när inget finns sparat", () => {
    expect(loadThreads()).toEqual([]);
  });

  it("saveThreads och loadThreads roundtrippar", () => {
    const threads = [
      {
        id: "t1",
        title: "Test",
        updatedAt: 123,
        messages: [],
      },
    ];
    saveThreads(threads);
    expect(loadThreads()).toEqual(threads);
  });

  it("ensureThread skapar en ny tråd om den inte finns", () => {
    const thread = ensureThread("ny");
    expect(thread.id).toBe("ny");
    expect(thread.title).toBe("Ny chatt");
    expect(loadThreads()).toHaveLength(1);
  });

  it("updateThread sätter titel från första användarmeddelandet", () => {
    ensureThread("t1");
    updateThread("t1", [
      {
        id: "m1",
        role: "user",
        parts: [{ type: "text", text: "Vem är bäst i Allsvenskan?" }],
      },
    ]);

    const [thread] = loadThreads();
    expect(thread?.title).toBe("Vem är bäst i Allsvenskan?");
  });

  it("deleteThread tar bort tråden", () => {
    ensureThread("t1");
    deleteThread("t1");
    expect(loadThreads()).toHaveLength(0);
  });
});
