import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createMemoryStorage,
  installMemoryStorageIfMissing,
} from "~/test/memory-storage";

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

describe("installMemoryStorageIfMissing", () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage"
  );

  afterEach(() => {
    if (originalDescriptor === undefined) {
      Reflect.deleteProperty(globalThis, "localStorage");
    } else {
      Object.defineProperty(globalThis, "localStorage", originalDescriptor);
    }
  });

  it("installs usable storage when localStorage is missing", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: undefined,
    });

    installMemoryStorageIfMissing();

    expect(globalThis.localStorage).toBeDefined();
    globalThis.localStorage.setItem("draft", "saved");
    expect(globalThis.localStorage.getItem("draft")).toBe("saved");
    globalThis.localStorage.clear();
    expect(globalThis.localStorage.length).toBe(0);
  });

  it("installs usable storage when the localStorage getter throws", () => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get(): never {
        throw new DOMException("Storage is disabled", "SecurityError");
      },
    });

    expect(installMemoryStorageIfMissing).not.toThrow();
    globalThis.localStorage.setItem("draft", "saved");
    expect(globalThis.localStorage.getItem("draft")).toBe("saved");
  });

  it("preserves storage already supplied by the environment", () => {
    const suppliedStorage = createMemoryStorage();
    suppliedStorage.setItem("existing", "kept");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: suppliedStorage,
    });

    installMemoryStorageIfMissing();

    expect(globalThis.localStorage).toBe(suppliedStorage);
    expect(globalThis.localStorage.getItem("existing")).toBe("kept");
  });
});
