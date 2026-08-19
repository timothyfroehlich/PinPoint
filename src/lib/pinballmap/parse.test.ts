import { describe, it, expect } from "vitest";
import regionLmxFixture from "./fixtures/region-austin-lmxes.json";
import regionLocationFixture from "./fixtures/region-austin-locations.json";
import { parseRegionLmxes, parseRegionLocations } from "./parse";

/**
 * Contract tests for the region readers, against CAPTURED REAL PAYLOADS.
 *
 * `fixtures/region-austin-lmxes.json` and `fixtures/region-austin-locations.json`
 * are unmodified responses from PinballMap for the Austin region, captured
 * 2026-08-17 from `GET /region/austin/location_machine_xrefs.json` and
 * `GET /region/austin/locations.json?no_details=1`. Only whitespace differs —
 * they were pretty-printed so the checked-in diff is reviewable, and the repo's
 * formatter owns them from here. No field was added, removed or edited.
 *
 * Everything else asserting this wire format does so against hand-written
 * fixtures derived from reading PBM's controller source. Those are correct — the
 * capture confirmed them field for field — but they can only ever restate what we
 * already believed. These tests are the ones that would catch PBM *changing*
 * its serializer, which is the failure this integration cannot detect at runtime:
 * a shape change makes entries drop silently and looks exactly like a quiet day.
 *
 * Offline by construction (CORE-TEST-006) — the payload is on disk, nothing here
 * reaches pinballmap.com.
 */

/** The complete wire shape of a region LMX record, per PBM's controller. */
const EXPECTED_LMX_FIELDS = [
  "created_at",
  "ic_enabled",
  "id",
  "location_id",
  "machine_id",
  "updated_at",
];

describe("parseRegionLmxes against the captured Austin payload", () => {
  const raw = regionLmxFixture.location_machine_xrefs;

  it("parses every entry — zero drops", () => {
    const parsed = parseRegionLmxes(regionLmxFixture);

    expect(parsed).toHaveLength(487);
    // The real assertion: nothing was skipped. `parseRegionLmx` drops records it
    // cannot place, silently and without a count, so a shrinking parse is how a
    // shape change would reach us. Pinning parsed === raw makes that loud.
    expect(parsed).toHaveLength(raw.length);
  });

  it("sees no field outside the six PBM documents", () => {
    const observed = new Set(raw.flatMap((entry) => Object.keys(entry)));

    expect([...observed].sort()).toEqual(EXPECTED_LMX_FIELDS);
  });

  it("carries no nested machine, location or conditions object", () => {
    // The index action serializes with `includes: []` / `methods: []`. Only
    // `#show` nests a machine — the distinction the whole label-resolution design
    // rests on, since it is why names come from our own mirror instead.
    for (const key of ["machine", "location", "machine_conditions", "name"]) {
      expect(EXPECTED_LMX_FIELDS).not.toContain(key);
    }
  });

  it("keeps the three ids and discards the rest", () => {
    const [first] = parseRegionLmxes(regionLmxFixture);

    expect(first).toEqual({
      lmxId: 218250,
      locationId: 26454,
      machineId: 4532,
    });
  });
});

describe("parseRegionLocations against the captured Austin payload", () => {
  it("names every location — 75 of 75", () => {
    const parsed = parseRegionLocations(regionLocationFixture);

    expect(parsed).toHaveLength(75);
    expect(parsed).toHaveLength(regionLocationFixture.locations.length);
    expect(parsed.every((l) => l.name.length > 0)).toBe(true);
  });

  it("can name every location the LMX payload references", () => {
    // The property the alert actually depends on: a venue id with no name falls
    // back to `location #123` in the Discord post.
    const named = new Set(
      parseRegionLocations(regionLocationFixture).map((l) => l.locationId)
    );
    const referenced = new Set(
      parseRegionLmxes(regionLmxFixture).map((e) => e.locationId)
    );

    expect([...referenced].filter((id) => !named.has(id))).toEqual([]);
  });

  it("ignores the fields `no_details=1` still returns", () => {
    // `no_details` strips the heavy nested content, NOT the scalar columns: each
    // row still arrives with ~20 fields (city, lat, machine_count, …). We read
    // two of them, and this pins that the extras stay out of the parsed shape.
    const [first] = parseRegionLocations(regionLocationFixture);

    expect(
      Object.keys(regionLocationFixture.locations[0] ?? {}).length
    ).toBeGreaterThan(2);
    expect(first).toEqual({
      locationId: 29910,
      name: "American Legion J.Q. Adams Post 223",
    });
  });
});
