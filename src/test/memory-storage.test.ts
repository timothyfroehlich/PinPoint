import { beforeEach, describe, expect, it } from "vitest";

import { createMemoryStorage } from "~/test/memory-storage";

describe("createMemoryStorage", () => {
  let storage: Storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it("starts empty", () => {
    expect(storage.length).toBe(0);
    expect(storage.getItem("missing")).toBeNull();
    expect(storage.key(0)).toBeNull();
  });

  it("stores and reads back values", () => {
    storage.setItem("draft", "hello");
    expect(storage.getItem("draft")).toBe("hello");
    expect(storage.length).toBe(1);
  });

  it("overwrites an existing key without growing length", () => {
    storage.setItem("draft", "one");
    storage.setItem("draft", "two");
    expect(storage.getItem("draft")).toBe("two");
    expect(storage.length).toBe(1);
  });

  it("removes a single key", () => {
    storage.setItem("a", "1");
    storage.setItem("b", "2");
    storage.removeItem("a");
    expect(storage.getItem("a")).toBeNull();
    expect(storage.getItem("b")).toBe("2");
    expect(storage.length).toBe(1);
  });

  it("clears every key", () => {
    storage.setItem("a", "1");
    storage.setItem("b", "2");
    storage.clear();
    expect(storage.length).toBe(0);
    expect(storage.getItem("a")).toBeNull();
    expect(storage.getItem("b")).toBeNull();
  });

  it("exposes keys by insertion order", () => {
    storage.setItem("first", "1");
    storage.setItem("second", "2");
    expect(storage.key(0)).toBe("first");
    expect(storage.key(1)).toBe("second");
    expect(storage.key(2)).toBeNull();
  });
});
