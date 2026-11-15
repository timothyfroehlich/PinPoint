import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIST_RETURN_EVENT,
  readListUrl,
  rememberListUrl,
} from "./return-to-list";

describe("return to a list (list-views §11)", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns the last URL a list showed this tab session", () => {
    const changed = vi.fn();
    window.addEventListener(LIST_RETURN_EVENT, changed);
    rememberListUrl("/m", "/m?status=unplayable&page=2");
    window.removeEventListener(LIST_RETURN_EVENT, changed);

    expect(readListUrl("/m")).toBe("/m?status=unplayable&page=2");
    expect(changed).toHaveBeenCalledTimes(1);
    expect(readListUrl("/c/abc")).toBeNull();
  });

  it("never returns a URL outside the list it was stored for", () => {
    window.sessionStorage.setItem("pinpoint:list-return:/m", "/admin");
    expect(readListUrl("/m")).toBeNull();
    window.sessionStorage.setItem("pinpoint:list-return:/m", "/machines-x");
    expect(readListUrl("/m")).toBeNull();
    window.sessionStorage.setItem("pinpoint:list-return:/m", "/m");
    expect(readListUrl("/m")).toBe("/m");
  });

  it("falls back to the plain list when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(() => rememberListUrl("/m", "/m?q=x")).not.toThrow();
    expect(readListUrl("/m")).toBeNull();
  });
});
