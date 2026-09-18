import { describe, expect, it } from "vitest";

import { classListIsUnpaired } from "../../../eslint-rules/no-unpaired-animate-motion.mjs";

/**
 * Unit coverage for the pure predicate behind pinpoint/no-unpaired-animate-motion
 * (CORE-A11Y-002). The oxlint fixture harness proves the rule fires on the right
 * AST positions; this isolates the class-string logic — the motion-safe skip, the
 * variant-prefixed pairing, and the tokenization — branch by branch.
 */
describe("classListIsUnpaired", () => {
  it.each([
    "animate-spin",
    "size-4 animate-spin",
    "animate-pulse text-muted-foreground",
    "animate-bounce",
    // Variant-prefixed animate still needs a pairing.
    "md:animate-spin",
    "size-4 animate-spin opacity-50", // pairing genuinely absent
  ])("flags an unpaired bare animate utility: %s", (classes) => {
    expect(classListIsUnpaired(classes)).toBe(true);
  });

  it.each([
    // Paired in the same class list.
    "animate-spin motion-reduce:animate-none",
    "size-4 animate-pulse motion-reduce:animate-none rounded-md",
    "animate-bounce motion-reduce:animate-none",
    // A single pairing covers multiple animate tokens.
    "animate-spin animate-pulse motion-reduce:animate-none",
    // Variant-prefixed pairing token satisfies the pairing.
    "md:animate-pulse md:motion-reduce:animate-none",
    // motion-safe: gates on the same media query, so no pairing is needed.
    "motion-safe:animate-spin",
    // Not one of the three bare utilities.
    "animate-none",
    "transition-none",
    "animate-ping", // out of this rule's scope
    "flex items-center gap-2",
    "", // empty
    // A longer utility that merely starts with a bare name is not a match.
    "animate-spin-slow",
  ])("stays silent on a conforming class list: %s", (classes) => {
    expect(classListIsUnpaired(classes)).toBe(false);
  });
});
